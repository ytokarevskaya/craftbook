-- SQL NULL must not turn a malformed JSON shape into a successful CHECK.
ALTER TABLE app.document ADD CONSTRAINT note_root_shape CHECK (
 kind='file' OR COALESCE(jsonb_typeof(body_json)='object'
 AND body_json->>'version'='1' AND body_json->'doc'->>'type'='doc'
 AND jsonb_typeof(body_json->'doc'->'content')='array',false)
);
