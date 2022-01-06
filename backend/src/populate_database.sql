DO $$
-- declare
DECLARE
number_rows INTEGER := 200000;
cleanup bool := True;
BEGIN	
	-- INSERT number_rows rows into backend_feature_result
	-- INSERT number_rows*50 rowx into backend_step_result
	-- app_id, environment_id, browser_id, department_id, feature_id are random values
	-- if cleanup is True , delete all rows and insert new rows in tables : 
	-- 		backend_department
	--		backend_features
	--		backend_environments
	-- 		backend_browsers
	-- 		backend_step
	-- 		backend_applications
	-- function populate_database params : 
	--  	number_features integer,
	-- 		app_id integer,
	-- 		feature_id integer,
	-- 		environment_id integer,
	-- 		browser_id integer,
	-- 		department_id integer,
    -- 		cleanup_master_tables bool 
	PERFORM populate_database(number_rows, NULL, NULL, NULL, NULL , NULL, cleanup);
	
END $$;


