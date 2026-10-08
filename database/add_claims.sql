-- Run this migration once before using the Claim section.
create table if not exists claims (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  customer_name varchar(150) not null,
  policy_number varchar(100) null,
  contact_person varchar(150) null,
  phone varchar(50) not null,
  vehicle_no varchar(100) null,
  claim_no varchar(100) null,
  claim_registration_date date null,
  follow_up_date date null,
  follow_up_remarks text null,
  final_settlement_date date null,
  description_of_claim text null,
  document varchar(255) null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  unique key uq_claims_organization_claim_no (organization_id, claim_no),
  key idx_claims_organization_follow_up (organization_id, follow_up_date),
  key idx_claims_organization_settlement (organization_id, final_settlement_date),
  constraint fk_claims_organization foreign key (organization_id) references organizations(id)
);