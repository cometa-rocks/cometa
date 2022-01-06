CREATE OR REPLACE FUNCTION populate_database
(
	number_features integer,
	app_id integer,
	feature_id integer,
	environment_id integer,
	browser_id integer,
	department_id integer,
    cleanup_master_tables bool)
RETURNS text AS
$$
DECLARE
counter INTEGER := 1 ;
new_feature_id INTEGER := 1;
last_feat_insert_id INTEGER := 1;
ins BOOL := False;
env_c INTEGER := 1 ;
apps text[] := ARRAY['MIF', 'DIF', 'MIN', 'WIG', 'BIG', 'TRY', 'KIK', 'YII', 'LIN', 'RIN'];
envs text[] := ARRAY[''];
features text[] := ARRAY['one','two','three','four','five'];
dep text[] := ARRAY[''];
browsers text[] := ARRAY['IE-8', 'IE-9','IE-10', 'IE-11', 'IE-12','IE-EDGE', 'Firefox', 'Chrome','Safari','Opera'];
BEGIN
	new_feature_id := (select last_value from backend_feature_result_feature_result_id_seq) + 1;
	--CREATE TEMP TABLE feature_result_temp as select * from backend_feature_result; 
	last_feat_insert_id := new_feature_id + number_features;
	
	IF cleanup_master_tables = True THEN	
		delete from backend_application;
		ALTER SEQUENCE backend_application_app_id_seq RESTART WITH 1;
		delete from backend_environment;
		ALTER SEQUENCE backend_environment_environment_id_seq RESTART WITH 1;
		delete from backend_department;
		ALTER SEQUENCE backend_department_department_id_seq RESTART WITH 1;
		delete from backend_feature;
		ALTER SEQUENCE backend_feature_feature_id_seq RESTART WITH 1;
		delete from backend_browser;
		ALTER SEQUENCE backend_browser_browser_id_seq RESTART WITH 1;
		delete from backend_account;
		ALTER SEQUENCE backend_account_user_id_seq RESTART WITH 1;
	END IF;
	
	IF (select count(*) from backend_account) < 3 THEN
	    
		insert into backend_account (user_name, email, user_role) 
		values ('Usuario Uno', 'prueba1@hotmail.com' , 'SUPERUSER');
		
		insert into backend_account (user_name, email, user_role) 
		values ('Usuario Dos', 'prueba2@hotmail.com' , 'DEVOP');
		insert into backend_account_role (user_id, department_id) 
		values ((select last_value from backend_account_user_id_seq), 1);
		insert into backend_account_role (user_id, department_id) 
		values ((select last_value from backend_account_user_id_seq), 2);
		insert into backend_account_role (user_id, department_id) 
		values ((select last_value from backend_account_user_id_seq), 3);
		
		insert into backend_account (user_name, email, user_role) 
		values ('Usuario Tres', 'prueba3@hotmail.com' , 'ANALYSIS');
		insert into backend_account_role (user_id, department_id) 
		values ((select last_value from backend_account_user_id_seq), 4);
		insert into backend_account_role (user_id, department_id) 
		values ((select last_value from backend_account_user_id_seq), 5);
		insert into backend_account_role (user_id, department_id) 
		values ((select last_value from backend_account_user_id_seq), 6);

	END IF;
	
	IF (select count(*) from backend_application) < 10 THEN
	    counter := 1;
		WHILE counter <= 10 LOOP
			insert into backend_application (app_name, slug) values (apps[counter], apps[counter]);
			counter := counter + 1 ;
		END LOOP;
	END IF;
	
	IF (select count(*) from backend_environment) < 35 THEN
		ins := True;
	END IF;
	
	WHILE env_c <= 35 LOOP
		envs[env_c] :=  concat('ENV-',env_c);
		IF ins = True Then
			insert into backend_environment (environment_name) values (envs[env_c]);
		END IF;
		env_c := env_c + 1 ;
	END LOOP;
	
	IF (select count(*) from backend_feature) < 5 THEN
		counter := 1;
		WHILE counter <= 5 LOOP
			insert into backend_feature (feature_name, app_id, environment_id, steps, schedule, slug) 
			values (features[counter], trunc(random() * 4 + 1), trunc(random() * 34 + 1)
					,trunc(random() * 9 + 1), '5 * * * *', features[counter]);
			counter := counter + 1 ;
		END LOOP;
	END IF;
	
	ins := False;
	IF (select count(*) from backend_department) < 10 THEN
		ins := True;
	END IF;
	
	counter := 1;
	WHILE counter <= 10 LOOP
		dep[counter] :=  concat('Dep-',counter);
		IF ins = True Then
			insert into backend_department (department_name, slug) values (dep[counter], dep[counter]);
		END IF;
		counter := counter + 1 ;
	END LOOP;
	counter := 1;
	
	IF (select count(*) from backend_browser) < 10 THEN
	    counter := 1;
		WHILE counter <= 10 LOOP
			insert into backend_browser (browser_name) values (browsers[counter]);
			counter := counter + 1 ;
		END LOOP;
	END IF;
	
	IF (select count(*) from backend_step) < 250 THEN
	    INSERT INTO backend_step
		(feature_id,step_name) 
		SELECT 
		    trunc(random() * 4 + 1) 
			,concat('Step-',i)
		FROM
			generate_series(1, 250) i;
	END IF;
	
	INSERT INTO backend_feature_result 
		(result_date
		,feature_id
		,feature_name
		,app_id
		,app_name
		,department_id
		,department_name
		,browser_id
		,browser_name
		,environment_id		
		,environment_name
		,screen_style
		,screen_actual
		,screen_diff
		,total
		,fails, ok, skipped, execution_time, pixel_diff, success_rate) 
		SELECT NOW() + (random() * (NOW()+'90 days' - NOW())) + '30 days'
           	,CASE WHEN feature_id IS NULL then trunc(random() * 4 + 1) else app_id end
			,CASE WHEN feature_id IS NULL then features[trunc(random() * 4 + 1)] else features[feature_id] end
			,CASE WHEN app_id IS NULL then random() * 9 + 1 else app_id end
			,CASE WHEN app_id IS NULL then apps[trunc(random() * 9 + 1)] else apps[app_id] end
			,CASE WHEN department_id IS NULL then random() * 9 + 1 else department_id end
			,CASE WHEN department_id IS NULL then dep[trunc(random() * 9 + 1)] else dep[department_id] end
			,CASE WHEN browser_id IS NULL then random() * 9 + 1 else browser_id end
			,CASE WHEN browser_id IS NULL then browsers[trunc(random() * 9 + 1)] else browsers[browser_id] end
            ,CASE WHEN environment_id IS NULL then random() * 34 + 1 else environment_id end
			,CASE WHEN environment_id IS NULL then envs[trunc(random() * 34 + 1)] else envs[environment_id] end
			,'/code/path.png'
			,'/code/path.png'
			,'/code/path.png'
			,random() * 100 + 1
			,random() * 100 + 1,random() * 100 + 1,random() * 100 + 1,random() * 10 + 1
			,floor(random()* (3000 - 2000 + 1) + 2000)
			,random() * 99 + 1
		FROM
			generate_series(1,number_features) i;
    
		INSERT INTO backend_step_result 
		(feature_result_id
		,step_name, execution_time, pixel_diff
		,success) 
		SELECT 
			floor(random()* (last_feat_insert_id - new_feature_id + 1) + new_feature_id)
		    ,concat('Step-',i)
			,random() * 10 + 1
			,floor(random()* (3000 - 2000 + 1) + 2000)
			,CASE WHEN MOD(i,3) = 0 then True else False end
		FROM
			generate_series(1,number_features* 50) i;
--insert into backend_feature_result select * from feature_result_temp;
--DROP TABLE feature_result_temp;
raise notice 'new feature_result_id: %', new_feature_id;
raise notice 'Rows inserted in feature_result: %', number_features;
raise notice 'Rows inserted in step_result: %', number_features*50;
raise notice 'Total Rows inserted : %', number_features + number_features*50;

RETURN 'success';

END;
$$
LANGUAGE 'plpgsql';

