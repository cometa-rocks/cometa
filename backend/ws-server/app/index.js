/* Setup Server */
var app = require('express')()
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var morgan = require('morgan');

/* Setup POST parser */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Save past messages as FeatureID --> FeatureRunID --> Message[]
const messagesObj = {};

// Save feature statuses
const status = {};

// Save data_driven statuses
const dataDrivenRunStatus = {};

// Save client information for each SocketID
const clients = {};

/**
 * Automatically constructs the messages structure for a given feature and run id
 * @param featureId Feature ID
 * @param featureRunId Feature Run ID
 * @returns Ref<Object>
 */
function constructRun(featureId, featureRunId) {
  if (featureId && !messagesObj.hasOwnProperty(featureId)) {
    // Create Feature key
    messagesObj[featureId] = {};
  }
  if (featureRunId && !messagesObj[featureId].hasOwnProperty(featureRunId)) {
    // Create FeatureRun key
    messagesObj[featureId][featureRunId] = [];
  }
  // Return reference to constructed object
  return messagesObj[featureId][featureRunId];
}

/**
 * Sets the current status for a given feature
 * @param featureId Feature ID
 * @param running Whether or not the feature is running
 */
function setRunningStatus(featureId, running) {
  if (!status.hasOwnProperty(featureId)) {
    status[featureId] = {};
  }
  status[featureId].running = running;
}

/**
 * Sets the current status for a given data driven run ID 
 * @param dataDrivenRunID Feature ID
 * @param running Whether or not the feature is running
 * @param metrics Additional metrics to store
 */
function setDataDrivenRunningStatus(dataDrivenRunID, running, metrics = {}) {
  if (!dataDrivenRunStatus.hasOwnProperty(dataDrivenRunID)) {
    dataDrivenRunStatus[dataDrivenRunID] = {};
  }
  dataDrivenRunStatus[dataDrivenRunID].running = running;
  
  // Store additional metrics if provided
  if (metrics) {
    dataDrivenRunStatus[dataDrivenRunID] = {
      ...dataDrivenRunStatus[dataDrivenRunID],
      ...metrics
    };
  }
}

/**
 * Returns the past messages for a given feature
 * @param featureId Feature ID
 */
function retrieveMessages(featureId) {
  return messagesObj[featureId];
}

/* Setup Logger */
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

/* WS Endpoint: Feature has been queued (environment, browserstack, etc) */
app.get('/feature/:feature_id/queued', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - feature_info: Feature --> Feature object with info of the running feature
   *  - run_id: number --> ID of run containing all browser results
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  setRunningStatus(+req.params.feature_id, true);
  const payload = {
    type: '[WebSockets] Feature Queued',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    datetime: req.body.datetime,
    pid: parseInt(req.body.pid),
    user_id: +req.body.user_id
  }
  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  res.status(200).json({ success: true })
})

/* WS Endpoint: Feature has been begin initializing (environment, browserstack, etc) */
app.get('/feature/:feature_id/initializing', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - feature_info: Feature --> Feature object with info of the running feature
   *  - run_id: number --> ID of run containing all browser results
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  setRunningStatus(+req.params.feature_id, true);
  const payload = {
    type: '[WebSockets] Initializing Feature',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    datetime: req.body.datetime,
    pid: parseInt(req.body.pid),
    user_id: +req.body.user_id
  }
  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  res.status(200).json({ success: true })
})

/* WS Endpoint: Feature has just started */
app.get('/feature/:feature_id/started', (req, res) => {
 /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - feature_info: Feature --> Feature object with info of the running feature
   *  - run_id: number --> ID of run containing all browser results
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  setRunningStatus(+req.params.feature_id, true);
  const payload = {
    type: '[WebSockets] Started Feature',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    start_at: new Date().toISOString(),
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    datetime: req.body.datetime,
    user_id: +req.body.user_id
  }
  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  res.status(200).json({ success: true })
})

/* WS Endpoint: Step has been begin */
app.post('/feature/:feature_id/stepBegin', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - run_id: number --> ID of run containing all browser results
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - step_name: string --> Full text of the step
   *  - step_index: number --> Index of the step relative to the Feature, please begin with 0
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  const payload = {
    type: '[WebSockets] Started Step',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    step_name: req.body.step_name,
    step_index: +req.body.step_index,
    datetime: req.body.datetime,
    user_id: +req.body.user_id
  }
  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  res.status(200).json({ success: true })
});

/* WS Endpoint: Step has more detailed info */
app.post('/feature/:feature_id/stepDetail', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - run_id: number --> ID of run containing all browser results
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - step_index: number --> Index of the step relative to the Feature, please begin with 0
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   *  - info: string --> Detailed info about the current status of the step, if any
   */
  const payload = {
    type: '[WebSockets] Step Detailed Info',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    step_index: +req.body.step_index,
    datetime: req.body.datetime,
    user_id: +req.body.user_id,
    info: req.body.info,
    screenshots: req.body.screenshots ? JSON.parse(req.body.screenshots) : {},
  }
  console.log(payload)
  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  console.log('WS step detailed info', +req.params.feature_id, 'Run ID', +req.body.run_id, 'Payload', payload)
  res.status(200).json({ success: true })
})

/* WS Endpoint: Step has been finished */
app.post('/feature/:feature_id/stepFinished', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - run_id: number --> ID of run containing all browser results
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - step_name: string --> Full text of the step
   *  - step_index: number --> Index of the step relative to the Feature, please begin with 0
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   *  - step_result_info: StepResult --> StepResult object stored in the database
   *  - step_time: number --> How many milliseconds did the step took?
   *  - error: string --> Error produced by the test if existing, otherwise empty
   */
  

  const payload = {
    type: '[WebSockets] Finished Step',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    step_name: req.body.step_name,
    step_index: +req.body.step_index,
    step_result_info: JSON.parse(req.body.step_result_info),
    datetime: req.body.datetime,
    step_time: req.body.step_time,
    error: req.body.error,
    status: req.body.status,
    user_id: +req.body.user_id,
    screenshots: req.body.screenshots ? JSON.parse(req.body.screenshots) : {},
    vulnerable_headers_count:req.body.vulnerable_headers_count,
    mobiles_info: req.body.mobiles_info? req.body.mobiles_info : [],
  }

  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  console.log('WS finished step', +req.params.feature_id, 'Run ID', +req.body.run_id, 'Payload', payload)
  res.status(200).json({ success: true })
})

/* WS Endpoint: Feature has just finished and data is being processed */
// This endpoint is no longer relevant
app.get('/feature/:feature_id/processing', (req, res) => {
 /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - feature_info: Feature --> Feature object with info of the running feature
   *  - run_id: number --> ID of run containing all browser results
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  io.emit('message', {
    type: '[WebSockets] Processing Feature',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    datetime: req.body.datetime,
    user_id: +req.body.user_id
  })
  res.status(200).json({ success: true })
})

/* WS Endpoint: Feature has been finished */
app.post('/feature/:feature_id/finished', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - run_id: number --> ID of run containing all browser results
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   *  - feature_result_info: FeatureResult --> FeatureResult object stored in the database
   *  - total_time: number --> How many milliseconds did the feature took?
   */
  const payload = {
    type: '[WebSockets] Finished Feature',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    feature_result_info: JSON.parse(req.body.feature_result_info),
    datetime: req.body.datetime,
    user_id: +req.body.user_id
  }
  io.emit('message', payload)
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  console.log('WS finished feature', +req.params.feature_id, 'Run ID', +req.body.run_id)
  res.status(200).json({ success: true })
})

/* WS Endpoint: Feature run has been completed */
app.post('/feature/:feature_id/runCompleted', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - run_id: number --> ID of run containing all browser results
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  setRunningStatus(+req.params.feature_id, false);
  const payload = {
    type: '[WebSockets] Completed Feature Run',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    datetime: req.body.datetime,
    user_id: +req.body.user_id
  }
  io.emit('message', payload);
  /**
   * Cleanup past messages
   */
  const featureId = +req.params.feature_id;
  const featureRunId = +req.body.run_id;
  // Delete current run
  if (messagesObj?.[featureId]?.[featureRunId]) {
    delete messagesObj[featureId][featureRunId];
  }
  // Delete current feature
  if (messagesObj?.[featureId]) {
    delete messagesObj[featureId];
  }
  res.status(200).json({ success: true })
})

/* WS Endpoint: Feature run has been forced to complete */
app.get('/feature/:feature_id/killed', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   */
  setRunningStatus(+req.params.feature_id, false);
  console.log('Killed featureId', req.params.feature_id)
  res.status(200).json({ success: true })
})

/* WS Endpoint: Generic error within Feature */
app.post('/feature/:feature_id/error', (req, res) => {
  /**
   * Required GET params:
   *  - feature_id: ID of the Feature
   * Required POST params:
   *  - browser_info: BrowserstackBrowser --> Browser object containing browser_name, browser_version, os, etc
   *  - run_id: number --> ID of run containing all browser results
   *  - feature_result_id: number --> Feature Result ID of the running test
   *  - datetime: string --> Time in which the step started, format: DD-MM-YYYY HH:mm:ss
   */
  const payload = {
    type: '[WebSockets] Feature Error',
    feature_id: +req.params.feature_id,
    run_id: +req.body.run_id,
    feature_result_id: +req.body.feature_result_id,
    browser_info: JSON.parse(req.body.browser_info),
    error: req.body.error,
    datetime: req.body.datetime,
    user_id: +req.body.user_id
  }
  io.emit('message', payload);
  // Add message to history
  const messages = constructRun(+req.params.feature_id, +req.body.run_id)
  messages.push(payload);
  res.status(200).json({ success: true })
})

/* WS Endpoint: Retrieve feature running status */
app.get('/featureStatus/:feature_id', (req, res) => {
  const featureId = +req.params.feature_id;
  let running = false;
  if (status[featureId] && status[featureId].running) running = true;
  res.status(200).json({ running: running });
})

/* WS Endpoint: Get Data Driven run status */
app.get('/dataDrivenStatus/:dataDrivenRunID', (req, res) => {
  const dataDrivenRunID = +req.params.dataDrivenRunID;
  let running = false;
  if (dataDrivenRunStatus[dataDrivenRunID] && dataDrivenRunStatus[dataDrivenRunID].running) running = true;
  res.status(200).json({ running: running });
})

/* WS Endpoint: Updating Data Driven running status */
app.post('/dataDrivenStatus/:dataDrivenRunID', (req, res) => {
  const runId = +req.params.dataDrivenRunID;
  const isRunning = req.body.running === true || req.body.running === 'True';
  const userId = req.body.user_id;
  const departmentId = req.body.department_id;

  console.log('Received dataDrivenStatus update:', runId, 'Running:', isRunning, 'User:', userId, 'Department:', departmentId);
  
  // Extract metrics from request body if available, ensuring proper types
  const metrics = {
    status: req.body.status,
    total: req.body.total !== undefined ? parseInt(req.body.total, 10) : undefined,
    ok: req.body.ok !== undefined ? parseInt(req.body.ok, 10) : undefined,
    fails: req.body.fails !== undefined ? parseInt(req.body.fails, 10) : undefined,
    skipped: req.body.skipped !== undefined ? parseInt(req.body.skipped, 10) : undefined,
    execution_time: req.body.execution_time !== undefined ? parseInt(req.body.execution_time, 10) : undefined,
    pixel_diff: req.body.pixel_diff !== undefined ? parseFloat(req.body.pixel_diff) : undefined
  };
  
  console.log('[WS] Raw metrics received:', {
    total_raw: req.body.total,
    total_parsed: metrics.total,
    ok_raw: req.body.ok,
    ok_parsed: metrics.ok,
    fails_raw: req.body.fails,
    fails_parsed: metrics.fails
  });
  
  // Update internal status with all available metrics
  setDataDrivenRunningStatus(runId, isRunning, metrics);

  // Construct payload for frontend clients
  const payload = {
    type: '[WebSockets] DataDrivenStatusUpdate', // Define a clear type
    run_id: runId,
    running: isRunning,
    // Include all available metrics
    ...metrics
  };

  let totalSent = 0;
  
  // Send to specific user if user_id is provided
  if (userId) {
    // Convert userId to number for proper comparison (it comes as string from request)
    const userIdNum = parseInt(userId, 10);
    console.log(`[DEBUG] Looking for user_id: ${userIdNum} (converted from ${userId})`);
    
    // Find clients belonging to the specific user
    for (const [clientId, client] of Object.entries(clients)) {
      if (client && client.user_id === userIdNum) {
        io.to(clientId).emit('message', payload);
        totalSent++;
        console.log(`Sent DataDrivenStatusUpdate to user ${userIdNum} (client: ${clientId})`);
      }
    }
    
    // If no clients found for the specific user, try department-based fallback
    if (totalSent === 0 && departmentId) {
      console.log(`No clients found for user ${userId}, falling back to department ${departmentId}`);
      for (const [clientId, client] of Object.entries(clients)) {
        if (client && client.departments && client.departments.some(dept => dept.department_id === departmentId)) {
          io.to(clientId).emit('message', payload);
          totalSent++;
        }
      }
    }
  } else {
    // Fallback to broadcasting to all clients (original behavior)
    io.emit('message', payload);
    totalSent = Object.keys(clients).length;
    console.log('No user_id provided, broadcasting to all clients');
  }

  console.log(`Emitted DataDrivenStatusUpdate to ${totalSent} clients:`, payload);
  
  // Debug: Log current client status
  console.log(`[DEBUG] Current clients connected: ${Object.keys(clients).length}`);
  for (const [clientId, client] of Object.entries(clients)) {
    console.log(`[DEBUG] Client ${clientId}: User ${client.user_id} (${client.email}), Departments: ${JSON.stringify(client.departments?.map(d => d.department_id) || 'none')}`);
  }
  
  res.status(200).json({ success: true, sentCount: totalSent });
})

// add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'WS server is running' });
})

/* WS Endpoint: Mobile container status update */
app.post('/mobile/container/status', (req, res) => {
  const containerId = req.body.container_id;
  const containerUpdate = req.body.containerUpdate;
  const userId = req.body.user_id;
  const departmentId = req.body.department_id;

  console.log('Received mobile container status update:', containerId, 'User:', userId, 'Department:', departmentId);
  
  const payload = {
    type: '[MobileWebSockets] Container Status Update',
    containerUpdate: containerUpdate
  };

  let totalSent = 0;
  
  // Send to specific user if user_id is provided
  if (userId) {
    const userIdNum = parseInt(userId, 10);
    for (const [clientId, client] of Object.entries(clients)) {
      if (client && client.user_id === userIdNum) {
        io.to(clientId).emit('message', payload);
        totalSent++;
      }
    }
    
    // Fallback to department-based if no user clients found
    if (totalSent === 0 && departmentId) {
      for (const [clientId, client] of Object.entries(clients)) {
        if (client && client.departments && client.departments.some(dept => dept.department_id === departmentId)) {
          io.to(clientId).emit('message', payload);
          totalSent++;
        }
      }
    }
  } else {
    // Broadcast to all clients
    io.emit('message', payload);
    totalSent = Object.keys(clients).length;
  }

  console.log(`Emitted mobile container status update to ${totalSent} clients:`, payload);
  res.status(200).json({ success: true, sentCount: totalSent });
})

/* WS Endpoint: Mobile container shared status update */
app.post('/mobile/container/shared', (req, res) => {
  const containerId = req.body.container_id;
  const shared = req.body.shared;
  const userId = req.body.user_id;
  const departmentId = req.body.department_id;

  console.log('Received mobile container shared update:', containerId, 'Shared:', shared, 'User:', userId, 'Department:', departmentId);
  
  const payload = {
    type: '[MobileWebSockets] Container Shared Update',
    container_id: containerId,
    shared: shared
  };

  let totalSent = 0;
  
  // Send to specific user if user_id is provided
  if (userId) {
    const userIdNum = parseInt(userId, 10);
    for (const [clientId, client] of Object.entries(clients)) {
      if (client && client.user_id === userIdNum) {
        io.to(clientId).emit('message', payload);
        totalSent++;
      }
    }
    
    // Fallback to department-based if no user clients found
    if (totalSent === 0 && departmentId) {
      for (const [clientId, client] of Object.entries(clients)) {
        if (client && client.departments && client.departments.some(dept => dept.department_id === departmentId)) {
          io.to(clientId).emit('message', payload);
          totalSent++;
        }
      }
    }
  } else {
    // Broadcast to all clients
    io.emit('message', payload);
    totalSent = Object.keys(clients).length;
  }

  console.log(`Emitted mobile container shared update to ${totalSent} clients:`, payload);
  res.status(200).json({ success: true, sentCount: totalSent });
})

/* WS Endpoint: Reload actions in front */
app.post('/updatedObjects/actions', (req, res) => {
  /* Params not required */
  io.emit('message', {
    type: '[Actions] Get All'
  })
  res.status(200).json({ success: true })
})

/* WS Endpoint: Reload folders in front */
app.post('/updatedObjects/folders', (req, res) => {
  /* Params not required */
  let toSend = Object.keys(clients);
  if (req.body.exclude && Array.isArray(req.body.exclude)) {
    // Filter clients excluding request user
    toSend = toSend.filter(client => !req.body.exclude.includes(clients[client].user_id));
  }
  // Send websocket to filtered clients
  toSend.forEach(client => {
    io.to(client).emit('message', {
      type: '[Features] Get Folders'
    })
  })
  res.status(200).json({ success: true })
})

/**
 * @description WS Endpoint to send any action to front
 * All possible actions, interfaces and necessary data is documented in docs/index.html of cometa-front project
 * It can be visualized using npm i http-server && npx http-server docs/ in front
 * To regenerate documentation please run npm i typedoc && npx typedoc src/app/store/actions src/app/others/interfaces.d.ts
 * @param req.body Must be a Front Action containing action type and action data
 */
app.post('/sendAction', (req, res) => {
  let totalSended = 0; // amount of users updated
  const type = req.body.type; // get the action type
  switch(type) { // depending on the action do certain things
    case '[Accounts] Add Account': // send update to only users with view_account permission
    case '[Accounts] Remove  Account': // send update to only users with view_account permission
      // filter all clients with "view_account" permission
      client_with_view_accounts_permission = Object.keys(clients).filter(client => {
        return clients[client].user_permissions.view_accounts == true;
      });
      // send data to only users with view_account permission
      client_with_view_accounts_permission.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Accounts] Modify Account':
      // get modified account's email
      const modified_accounts_email = req.body.account.email;
      // filter all clients with "view_account" permission or email == modified account email
      client_with_view_accounts_permission_or_updated_account = Object.keys(clients).filter(client => {
        return clients[client].user_permissions.view_accounts == true || clients[client].email == modified_accounts_email;
      });
      // send data to only users with view_account permission or if user is the one being updated
      client_with_view_accounts_permission_or_updated_account.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Departments] Add Admin Department':
      // filter all clients which have "view_departments_panel" permission
      clients_with_view_departments_panel_permission = Object.keys(clients).filter(client => {
        return clients[client].user_permissions.view_departments_panel == true;
      });
      // send data to only users with in the department
      clients_with_view_departments_panel_permission.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Departments] Update Department Info':
    case '[Departments] Remove Admin Department':
      // filter all clients which are in updated/removed department or have "view_departments_panel" permission
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.departmentId) || clients[client].user_permissions.view_departments_panel == true;
      });
      // send data to only users with in the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Files] Processing started':
    case '[Files] Virus scan started':
      // filter all clients which are in updated/removed department or have "view_departments_panel" permission
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.department_id) || clients[client].user_permissions.view_departments_panel == true;
      });
      // send data to only users with in the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Variables] Get All':
      // filter all clients which are in the same department
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.departmentId);
      });
      // send data to only users within the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Features] Folder got renamed':
      // filter all clients which are in removed folder's department
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.folder.department);
      });
      // send data to only users with in the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Features] Update feature offline':
      // filter all clients pertaining to the modified feature
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.feature.department_id);
      });
      // send data to only users within the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Features] Get Folders':
      // filter all clients pertaining to the folder department
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.department_id);
      });
      // send data to only users within the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    case '[Features] Folder got removed':
      // filter all clients which are in removed folder's department
      clients_with_in_the_department = Object.keys(clients).filter(client => {
        return clients[client].departments.some(dept => dept.department_id == req.body.department_id);
      });
      // send data to only users with in the department
      clients_with_in_the_department.forEach(client => {
        io.to(client).emit('message', req.body);
        totalSended++;
      });
      break;
    /**
     * default is used for:
     * - Actions
     * - Applications
     * - Browsers
     * - Remove Screenshot
     * - Department Add since it's done in views.py, because here we don't actually know who created the department
     */
    default:
      /* Params not required */
      let toSend = Object.keys(clients);
      if (req.body.exclude && Array.isArray(req.body.exclude)) {
        // Filter clients excluding request user
        toSend = toSend.filter(client => !req.body.exclude.includes(clients[client].user_id));
      }
      // Send websocket to filtered clients
      toSend.forEach(client => {
        io.to(client).emit('message', req.body)
      })
      totalSended = toSend.length;
      break;
  }
  res.status(200).json({ success: true, sendedCount: totalSended })
})

// Example of emitting updateDepartment only to those who own the department
app.post('/sendActionExample', (req, res) => {
  let totalSended = 0;
  for (const clientId in clients) {
    const client = clients[clientId];
    if (client && client.departments.some(dept => dept.department_id === req.body.department.department_id)) {
      io.to(clientId).emit('message', req.body);
      totalSended++;
    }
  }
  res.status(200).json({ success: true, sendedCount: totalSended })
})

io.on('connection', function(socket){
  try {
    const user = socket.handshake.auth.user;
    if (user.user_id != undefined && user.email != undefined) {
      clients[socket.id] = user
      console.log(`[${user.email} (${user.user_id})] has connected successfully.`)
      //console.log(`[DEBUG] User auth data:`, JSON.stringify(user, null, 2));
    } else {
      throw Error("Missing user data. Connection failed.")
    }
  } catch (err) {
    socket.emit("error", {
      "success": false,
      "message": err.message
    })
    socket.disconnect(true)
    console.log('Connection', 'Couldn\'t parse user info.');
  }
  // For testing purposes
  socket.on('test', function(data) {
    console.log(data);
    io.emit('message', data);
  })
  // Update user info from front
  socket.on('updateUser', function(data) {
    try {
      // Handle both object and string data
      const userData = typeof data === 'string' ? JSON.parse(data) : data;
      clients[socket.id] = userData;
      console.log(`[updateUser] Updated user info for ${userData.email} (${userData.user_id})`);
    } catch (err) {
      console.log('updateUser', 'Couldn\'t parse user info:', err.message);
    }
  })
  // Front asks to know previous messages for a given feature_id
  socket.on('featurePastMessages', function(data) {
    const featureId = +data.feature_id;
    // Get messages of given feature
    let messages = retrieveMessages(featureId);
    // Get id of the latest run
    const lastRunId = Math.max(Object.keys(messages))
    // Emit feature messages only to requesting client
    socket.emit('message', messages[lastRunId])
  })
  socket.on('disconnect', (reason) => {
    const user = clients[socket.id];
    if (user) {
      console.log(`[${user.email} (${user.user_id})] disconnected. Reason: ${reason}`);
    } else {
      console.log(`Unknown client ${socket.id} disconnected. Reason: ${reason}`);
    }
    delete clients[socket.id];
  });
})

server.listen(3001, function(){
  console.log('WS Server listening on *:3001')
})
