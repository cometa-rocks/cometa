#!/bin/bash
psql postgresql://postgres@localhost>/postgres << EOF
DO $$ 
-- declare
DECLARE
counter INTEGER := 1 ;
number_features INTEGER := 200000;
new_feature_id INTEGER := 1;
last_feat_insert_id INTEGER := 1;
env_c INTEGER := 1 ;
apps text[] := ARRAY['MIF', 'DIF', 'MIN', 'WIG', 'BIG', 'TRY', 'KIK', 'YII', 'LIN', 'RIN'];
envs text[] := ARRAY[''];
features text[] := ARRAY[''];
dep text[] := ARRAY[''];
browsers text[] := ARRAY['IE-8', 'IE-9','IE-10', 'IE-11', 'IE-12','IE-EDGE', 'Firefox', 'Chrome','Safari','Opera'];
BEGIN
	new_feature_id := (select last_value from backend_feature_result_feature_result_id_seq) + 1;
	--CREATE TEMP TABLE feature_result_temp as select * from backend_feature_result; 
	last_feat_insert_id := new_feature_id + number_features;
	WHILE env_c <= 35 LOOP
		envs[env_c] :=  concat('ENV-',env_c);
		env_c := env_c + 1 ;
	END LOOP;
	counter := 1;
	WHILE counter <= 10 LOOP
		features[counter] :=  counter;
		counter := counter + 1 ;
	END LOOP;
	counter := 1;
	WHILE counter <= 10 LOOP
		dep[counter] :=  concat('Dep-',counter);
		counter := counter + 1 ;
	END LOOP;
	counter := 1;
	INSERT INTO backend_feature_result 
		(result_date
		,feature_id
		,feature_name
		,app
		,department_id
		,department
		,browser_id
		,browser
		,environment
		,total
		,fails, ok, skipped, execution_time, pixel_diff, success_rate) 
		SELECT 
			current_timestamp
		    ,random() * 9 + 1
			,'Feature'
			,apps[trunc(random() * 9 + 1)]
			,random() * 9 + 1
			,dep[trunc(random() * 9 + 1)]
			,random() * 9 + 1
			,browsers[trunc(random() * 9 + 1)]
			,envs[trunc(random() * 34 + 1)]
			,random() * 100 + 1
			,random() * 100 + 1,random() * 100 - 10,random() * 100 - 10,random() * 10 - 10
			,floor(random()* (3000 - 2000 + 1) + 2000)
			,random() * 99 + 1
		FROM
			generate_series(1,number_features) i;
    
		INSERT INTO backend_step_result 
		(feature_result_id
		,step_name, execution_time, pixel_diff) 
		SELECT 
			floor(random()* (last_feat_insert_id - new_feature_id + 1) + new_feature_id)
		    ,concat('Step-',i)
			,random() * 10 - 1
			,floor(random()* (3000 - 2000 + 1) + 2000)
		FROM
			generate_series(1,number_features* 50) i;
--insert into backend_feature_result select * from feature_result_temp;
--DROP TABLE feature_result_temp;
raise notice 'new feature_result_id: %', new_feature_id;
raise notice 'Rows inserted in feature_result: %', number_features;
raise notice 'Rows inserted in step_result: %', number_features*50;
raise notice 'Total Rows inserted : %', number_features + number_features*50;
END $$;
EOF
