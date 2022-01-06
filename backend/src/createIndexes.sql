-- Index: index_feature_result

-- DROP INDEX public.index_feature_result;

CREATE INDEX ix_step_result
    ON public.backend_step_result USING btree
    (feature_result_id)
    TABLESPACE pg_default;

CREATE INDEX ix_app_env_feat
    ON public.backend_feature_result USING btree
    (feature_id, app_id, app_name COLLATE pg_catalog."default", environment_id, environment_name COLLATE pg_catalog."default")
    TABLESPACE pg_default;

CREATE INDEX ix_browser
    ON public.backend_feature_result USING btree
    (browser_id)
    TABLESPACE pg_default;


CREATE INDEX ix_dep
    ON public.backend_feature_result USING btree
    (department_id)
    TABLESPACE pg_default;
