-- Run once for databases where database/add_claims.sql has already been applied.
-- Adds Claim form fields and makes Policy Number, Claim No., and Registration Date optional.
alter table claims
  add column contact_person varchar(150) null after policy_number,
  add column phone varchar(50) null after contact_person;

alter table claims
  modify column policy_number varchar(100) null,
  modify column claim_no varchar(100) null,
  modify column claim_registration_date date null;

