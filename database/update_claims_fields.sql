-- Run once for databases where database/add_claims.sql has already been applied.
-- Adds the Claim form's Contact Person and Phone fields and makes Policy Number optional.
alter table claims
  add column contact_person varchar(150) null after policy_number,
  add column phone varchar(50) null after contact_person;

alter table claims modify column policy_number varchar(100) null;

