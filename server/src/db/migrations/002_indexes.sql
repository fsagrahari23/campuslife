-- Gate Pass Management System — Indexes
-- PostgreSQL Migration 002

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_gate_passes_student_id ON gate_passes(student_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_status ON gate_passes(status);
CREATE INDEX IF NOT EXISTS idx_gate_passes_version ON gate_passes(version);
CREATE INDEX IF NOT EXISTS idx_gate_passes_valid_until ON gate_passes(valid_until);
CREATE INDEX IF NOT EXISTS idx_gate_events_pass_id ON gate_events(pass_id);
CREATE INDEX IF NOT EXISTS idx_gate_events_timestamp ON gate_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_gate_events_event_id ON gate_events(event_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_event_id ON sync_events(event_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_device_id ON sync_events(device_id);
CREATE INDEX IF NOT EXISTS idx_revocations_pass_id ON revocations(pass_id);
CREATE INDEX IF NOT EXISTS idx_revocations_version ON revocations(version);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_guards_user_id ON guards(user_id);
