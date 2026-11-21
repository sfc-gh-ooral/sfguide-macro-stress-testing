-- Deploy the app as Streamlit in Snowflake (run after setup_synthetic.sql or setup.sql).
-- From the repository root with the Snowflake CLI or any client that supports PUT:
--   PUT file://app/streamlit_app.py @SNOWPACK_MACRO_STRESS.CORE.APP_STAGE/app AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
--   PUT file://app/stress_core.py   @SNOWPACK_MACRO_STRESS.CORE.APP_STAGE/app AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
--   PUT file://app/environment.yml  @SNOWPACK_MACRO_STRESS.CORE.APP_STAGE/app AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
--   PUT file://data/*.csv           @SNOWPACK_MACRO_STRESS.CORE.APP_STAGE/data AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
--   PUT file://data/sample/*.json   @SNOWPACK_MACRO_STRESS.CORE.APP_STAGE/data/sample AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
-- Or upload the same files in Snowsight (Data > Databases > SNOWPACK_MACRO_STRESS > CORE > Stages > APP_STAGE).
USE ROLE SNOWPACK_MACRO_STRESS_ROLE;
USE SCHEMA SNOWPACK_MACRO_STRESS.CORE;
CREATE STAGE IF NOT EXISTS APP_STAGE DIRECTORY = (ENABLE = TRUE);
-- (upload the files listed above, then:)
CREATE OR REPLACE STREAMLIT MACRO_STRESS_APP
  ROOT_LOCATION = '@SNOWPACK_MACRO_STRESS.CORE.APP_STAGE'
  MAIN_FILE = 'app/streamlit_app.py'
  QUERY_WAREHOUSE = SNOWPACK_MACRO_STRESS_WH
  TITLE = 'Macro Stress Testing';
