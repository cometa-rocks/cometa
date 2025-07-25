"""
File Lock Manager for Data-Driven Test Execution

This module provides distributed file locking functionality to prevent
concurrent DDT execution on the same file across multiple Django instances.

Author: Co.Meta Development Team
Version: 1.0.0
"""

import redis
import time
import os
import logging
import threading
import ssl
from typing import Optional, Dict, Any
from backend.utility.config_handler import get_cometa_redis_host, get_cometa_redis_port

logger = logging.getLogger(__name__)


class FileLockError(Exception):
    """Base exception for file lock operations."""
    pass


class FileLockAcquisitionError(FileLockError):
    """Raised when file lock cannot be acquired."""
    pass


class FileLockReleaseError(FileLockError):
    """Raised when file lock cannot be released."""
    pass


class FileLockManager:
    """
    Distributed file lock manager using Redis to prevent concurrent DDT execution
    on the same file across multiple Django instances.
    
    This implementation ensures that only one DDT run can process a specific file
    at any given time, preventing resource contention and ensuring data consistency.
    """
    
    def __init__(self):
        """Initialize the FileLockManager with Redis connection."""
        self._redis_client = None
        self._lock_timeout = 1800  # 30 minutes max lock duration
        self._acquire_timeout = 60  # 1 minute max wait time
        self._retry_interval = 1   # 1 second between retries
        
        # Thread safety for initialization
        self._init_lock = threading.Lock()
        
        # Initialize Redis connection
        self._initialize_redis()
    
    def _initialize_redis(self) -> None:
        """Initialize Redis connection with connection pooling and best practices."""
        try:
            # Use internal Redis container for file locking (verified working)
            redis_host = get_cometa_redis_host()  # Internal Redis container hostname
            redis_port = get_cometa_redis_port()
            redis_db = 0
            
            # Simple Redis connection pattern for internal container
            connection_params = {
                'host': redis_host,
                'port': redis_port,
                'db': redis_db,
                'socket_keepalive': True,
                'decode_responses': True,  # Important for string operations
            }
            
            logger.debug(f"FileLockManager connection params: {connection_params}")
            
            # Create Redis client with basic connection (most compatible)
            self._redis_client = redis.Redis(**connection_params)
            
            # Test the connection with ping
            self._redis_client.ping()
            logger.info("FileLockManager: Successfully connected to Redis")
            
        except redis.ConnectionError as e:
            logger.error(f"FileLockManager: Redis connection error: {e}")
            raise FileLockError(f"Redis connection failed: {e}")
        except redis.TimeoutError as e:
            logger.error(f"FileLockManager: Redis timeout error: {e}")
            raise FileLockError(f"Redis timeout: {e}")
        except redis.RedisError as e:
            logger.error(f"FileLockManager: Redis error: {e}")
            raise FileLockError(f"Redis error: {e}")
        except Exception as e:
            logger.error(f"FileLockManager: Unexpected error during Redis initialization: {e}")
            raise FileLockError(f"Redis initialization failed: {e}")
    
    def _generate_lock_identifier(self) -> str:
        """Generate a unique identifier for the lock."""
        return f"{time.time()}_{os.getpid()}_{threading.current_thread().ident}"
    
    def _get_lock_key(self, file_id: int) -> str:
        """Generate Redis key for file lock."""
        return f"ddt_file_lock_{file_id}"
    
    def acquire_file_lock(self, file_id: int, identifier: Optional[str] = None, 
                         timeout: Optional[int] = None) -> Optional[str]:
        """
        Acquire a distributed lock for a specific file using Redis 6.2.0 best practices.
        
        Args:
            file_id: The ID of the file to lock
            identifier: Optional unique identifier for the lock owner
            timeout: Optional timeout in seconds (defaults to configured value)
            
        Returns:
            Lock identifier if successful, None if lock acquisition failed
            
        Raises:
            FileLockAcquisitionError: If lock cannot be acquired due to system error
        """
        if not isinstance(file_id, int) or file_id <= 0:
            raise ValueError(f"Invalid file_id: {file_id}. Must be a positive integer.")
        
        if identifier is None:
            identifier = self._generate_lock_identifier()
        
        if timeout is None:
            timeout = self._acquire_timeout
        
        lock_key = self._get_lock_key(file_id)
        start_time = time.time()
        retry_count = 0
        max_retries = 3
        
        logger.info(f"Attempting to acquire lock for file {file_id} with identifier {identifier}")
        
        # Allow at least one attempt even when timeout is 0
        while time.time() - start_time < timeout or (timeout == 0 and retry_count == 0):
            try:
                # Use SET command with atomic guarantees
                lock_acquired = self._redis_client.set(
                    lock_key, 
                    identifier, 
                    nx=True,  # Only set if key doesn't exist
                    ex=self._lock_timeout  # Set expiration time in seconds
                )
                
                if lock_acquired:
                    logger.info(f"Successfully acquired lock for file {file_id} with identifier {identifier}")
                    return identifier
                
                # Check if lock is held by the same identifier (re-entrant behavior)
                current_holder = self._redis_client.get(lock_key)
                if current_holder == identifier:
                    logger.info(f"Lock for file {file_id} already held by same identifier {identifier}")
                    # Refresh the lock timeout using EXPIRE command
                    self._redis_client.expire(lock_key, self._lock_timeout)
                    return identifier
                
                # Log current lock holder for debugging
                if current_holder:
                    logger.debug(f"File {file_id} locked by {current_holder}, waiting...")
                
                # Exponential backoff with jitter (Redis 6.2.0 recommended pattern)
                wait_time = min(self._retry_interval * (2 ** retry_count), 5.0)
                jitter = wait_time * 0.1 * (0.5 - time.time() % 1)  # Add jitter
                time.sleep(wait_time + jitter)
                retry_count += 1
                
            except redis.ConnectionError as e:
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"Redis connection error while acquiring lock for file {file_id} after {max_retries} retries: {e}")
                    raise FileLockAcquisitionError(f"Redis connection error during lock acquisition: {e}")
                
                wait_time = 2 ** retry_count  # Exponential backoff for connection errors
                logger.warning(f"Redis connection error, retrying in {wait_time}s (attempt {retry_count}/{max_retries}): {e}")
                time.sleep(wait_time)
                
            except redis.TimeoutError as e:
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"Redis timeout error while acquiring lock for file {file_id} after {max_retries} retries: {e}")
                    raise FileLockAcquisitionError(f"Redis timeout during lock acquisition: {e}")
                
                logger.warning(f"Redis timeout, retrying (attempt {retry_count}/{max_retries}): {e}")
                time.sleep(1)
                
            except redis.RedisError as e:
                logger.error(f"Redis error while acquiring lock for file {file_id}: {e}")
                raise FileLockAcquisitionError(f"Redis error during lock acquisition: {e}")
            except Exception as e:
                logger.error(f"Unexpected error while acquiring lock for file {file_id}: {e}")
                raise FileLockAcquisitionError(f"Unexpected error during lock acquisition: {e}")
        
        logger.warning(f"Failed to acquire lock for file {file_id} after {timeout} seconds")
        return None
    
    def release_file_lock(self, file_id: int, identifier: str) -> bool:
        """
        Release a distributed lock for a specific file.
        
        Args:
            file_id: The ID of the file to unlock
            identifier: The identifier of the lock owner
            
        Returns:
            True if successfully released, False otherwise
            
        Raises:
            FileLockReleaseError: If lock cannot be released due to system error
        """
        if not isinstance(file_id, int) or file_id <= 0:
            raise ValueError(f"Invalid file_id: {file_id}. Must be a positive integer.")
        
        if not identifier:
            raise ValueError("Lock identifier cannot be empty")
        
        lock_key = self._get_lock_key(file_id)
        
        try:
            # Use Lua script to atomically check and delete the lock
            # Redis 6.2.0 optimized Lua script with better error handling
            lua_script = """
            local current_value = redis.call("GET", KEYS[1])
            if current_value == ARGV[1] then
                redis.call("DEL", KEYS[1])
                return {1, "released"}
            elseif current_value == false then
                return {0, "not_found"}
            else
                return {0, "not_owner"}
            end
            """
            
            # Execute Lua script with proper error handling
            result = self._redis_client.eval(lua_script, 1, lock_key, identifier)
            
            if result[0] == 1:
                logger.info(f"Successfully released lock for file {file_id} with identifier {identifier}")
                return True
            elif result[1] == "not_found":
                logger.info(f"Lock for file {file_id} was already released or expired")
                return True  # Consider this success since lock is gone
            else:
                logger.warning(f"Failed to release lock for file {file_id} - lock not held by {identifier} (reason: {result[1]})")
                return False
                
        except redis.RedisError as e:
            logger.error(f"Redis error while releasing lock for file {file_id}: {e}")
            raise FileLockReleaseError(f"Redis error during lock release: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while releasing lock for file {file_id}: {e}")
            raise FileLockReleaseError(f"Unexpected error during lock release: {e}")
    
    def is_file_locked(self, file_id: int) -> bool:
        """
        Check if a file is currently locked.
        
        Args:
            file_id: The ID of the file to check
            
        Returns:
            True if locked, False otherwise
        """
        if not isinstance(file_id, int) or file_id <= 0:
            raise ValueError(f"Invalid file_id: {file_id}. Must be a positive integer.")
        
        lock_key = self._get_lock_key(file_id)
        
        try:
            return self._redis_client.exists(lock_key) == 1
        except redis.RedisError as e:
            logger.error(f"Redis error while checking lock status for file {file_id}: {e}")
            return False  # Conservative approach: assume not locked on error
        except Exception as e:
            logger.error(f"Unexpected error while checking lock status for file {file_id}: {e}")
            return False
    
    def get_lock_info(self, file_id: int) -> Optional[Dict[str, Any]]:
        """
        Get information about who holds the lock for a file.
        
        Args:
            file_id: The ID of the file to check
            
        Returns:
            Dictionary with lock information or None if not locked
        """
        if not isinstance(file_id, int) or file_id <= 0:
            raise ValueError(f"Invalid file_id: {file_id}. Must be a positive integer.")
        
        lock_key = self._get_lock_key(file_id)
        
        try:
            # Use pipeline for atomic operations
            pipe = self._redis_client.pipeline()
            pipe.get(lock_key)
            pipe.ttl(lock_key)
            holder, ttl = pipe.execute()
            
            if holder:
                return {
                    'holder': holder,
                    'ttl': ttl,
                    'expires_at': time.time() + ttl if ttl > 0 else None,
                    'file_id': file_id
                }
            return None
            
        except redis.RedisError as e:
            logger.error(f"Redis error while getting lock info for file {file_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error while getting lock info for file {file_id}: {e}")
            return None
    
    def force_release_lock(self, file_id: int) -> bool:
        """
        Force release a lock (admin operation).
        
        Args:
            file_id: The ID of the file to unlock
            
        Returns:
            True if lock was removed, False if no lock existed
            
        Warning:
            This is an administrative operation that should only be used
            when a lock is stuck due to system failure.
        """
        if not isinstance(file_id, int) or file_id <= 0:
            raise ValueError(f"Invalid file_id: {file_id}. Must be a positive integer.")
        
        lock_key = self._get_lock_key(file_id)
        
        try:
            result = self._redis_client.delete(lock_key)
            if result == 1:
                logger.warning(f"Force released lock for file {file_id}")
                return True
            else:
                logger.info(f"No lock found to force release for file {file_id}")
                return False
                
        except redis.RedisError as e:
            logger.error(f"Redis error while force releasing lock for file {file_id}: {e}")
            raise FileLockReleaseError(f"Redis error during force lock release: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while force releasing lock for file {file_id}: {e}")
            raise FileLockReleaseError(f"Unexpected error during force lock release: {e}")
    
    def get_all_active_locks(self) -> Dict[int, Dict[str, Any]]:
        """
        Get information about all currently active file locks.
        
        Returns:
            Dictionary mapping file IDs to lock information
        """
        try:
            # Find all lock keys
            lock_pattern = "ddt_file_lock_*"
            lock_keys = self._redis_client.keys(lock_pattern)
            
            active_locks = {}
            
            for lock_key in lock_keys:
                try:
                    # Extract file_id from key
                    file_id = int(lock_key.split('_')[-1])
                    lock_info = self.get_lock_info(file_id)
                    
                    if lock_info:
                        active_locks[file_id] = lock_info
                        
                except (ValueError, IndexError) as e:
                    logger.warning(f"Invalid lock key format: {lock_key} - {e}")
                    continue
            
            return active_locks
            
        except redis.RedisError as e:
            logger.error(f"Redis error while getting active locks: {e}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error while getting active locks: {e}")
            return {}
    
    def cleanup_expired_locks(self) -> int:
        """
        Clean up any expired locks (Redis should handle this automatically, 
        but this provides manual cleanup capability).
        
        Returns:
            Number of locks cleaned up
        """
        try:
            # Find all lock keys
            lock_pattern = "ddt_file_lock_*"
            lock_keys = self._redis_client.keys(lock_pattern)
            
            cleaned_count = 0
            
            for lock_key in lock_keys:
                try:
                    ttl = self._redis_client.ttl(lock_key)
                    
                    # TTL of -1 means key exists but has no expiration
                    # TTL of -2 means key doesn't exist
                    if ttl == -1:
                        # This shouldn't happen with our implementation, but clean it up
                        self._redis_client.delete(lock_key)
                        cleaned_count += 1
                        logger.warning(f"Cleaned up lock without expiration: {lock_key}")
                        
                except redis.RedisError as e:
                    logger.error(f"Error checking TTL for {lock_key}: {e}")
                    continue
            
            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} expired locks")
            
            return cleaned_count
            
        except redis.RedisError as e:
            logger.error(f"Redis error during lock cleanup: {e}")
            return 0
        except Exception as e:
            logger.error(f"Unexpected error during lock cleanup: {e}")
            return 0
    
    def close_connections(self) -> None:
        """
        Properly close Redis connections and clean up resources.
        Should be called during application shutdown.
        """
        try:
            if hasattr(self, '_redis_client') and self._redis_client:
                if hasattr(self._redis_client, 'close'):
                    self._redis_client.close()
                logger.info("FileLockManager: Closed Redis connection")
        except Exception as e:
            logger.error(f"Error closing Redis connections: {e}")
    
    def __del__(self):
        """Cleanup on object destruction."""
        try:
            self.close_connections()
        except Exception:
            pass  # Ignore errors during cleanup


# Global instance - follows the pattern used in other utility modules
file_lock_manager = FileLockManager()