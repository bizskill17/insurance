create table agents (
  id bigint unsigned auto_increment primary key,
  employee_code varchar(30) not null unique,
  full_name varchar(150) not null,
  mobile varchar(20),
  email varchar(150),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp
);

create table users (
  id bigint unsigned auto_increment primary key,
  full_name varchar(150) not null,
  login_id varchar(120) not null unique,
  password varchar(255) not null,
  views longtext,
  add_permissions longtext,
  edit_permissions longtext,
  delete_permissions longtext,
  email varchar(150) not null unique,
  mobile varchar(20),
  role_name varchar(50) not null,
  linked_agent_id bigint unsigned null,
  notes text,
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_users_linked_agent
    foreign key (linked_agent_id) references agents(id)
);

create table agent_payment_accounts (
  id bigint unsigned auto_increment primary key,
  agent_id bigint unsigned not null,
  account_label varchar(150) not null,
  account_type varchar(30) not null,
  bank_name varchar(120),
  account_holder_name varchar(150),
  masked_account_number varchar(50),
  card_last4 varchar(10),
  upi_id varchar(150),
  branch_name varchar(120),
  is_default tinyint(1) not null default 0,
  is_active tinyint(1) not null default 1,
  notes text,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_agent_payment_accounts_agent
    foreign key (agent_id) references agents(id)
);

create table customer_groups (
  id bigint unsigned auto_increment primary key,
  group_name varchar(150) not null unique,
  notes text,
  created_at datetime not null default current_timestamp
);

create table customers (
  id bigint unsigned auto_increment primary key,
  customer_code varchar(30) not null unique,
  group_id bigint unsigned null,
  full_name varchar(150) not null,
  mobile varchar(20),
  alternate_mobile varchar(20),
  email varchar(150),
  date_of_birth date,
  anniversary_date date,
  pan varchar(20),
  aadhaar varchar(20),
  gstin varchar(20),
  father_name varchar(150),
  address_line_1 varchar(200),
  address_line_2 varchar(200),
  address_line_3 varchar(200),
  city varchar(100),
  state varchar(100),
  pincode varchar(20),
  is_active tinyint(1) not null default 1,
  notes text,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_customers_group
    foreign key (group_id) references customer_groups(id)
);

create table insurance_companies (
  id bigint unsigned auto_increment primary key,
  company_name varchar(200) not null unique,
  company_short_name varchar(80),
  company_type varchar(30),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp
);

create table states (
  id bigint unsigned auto_increment primary key,
  state_name varchar(100) not null unique,
  state_code varchar(20),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp
);

create table cities (
  id bigint unsigned auto_increment primary key,
  state_id bigint unsigned not null,
  city_name varchar(100) not null,
  city_code varchar(20),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  unique key uk_state_city (state_id, city_name),
  constraint fk_cities_state
    foreign key (state_id) references states(id)
);

create table product_categories (
  id bigint unsigned auto_increment primary key,
  category_name varchar(100) not null unique,
  parent_category_id bigint unsigned null,
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  constraint fk_product_categories_parent
    foreign key (parent_category_id) references product_categories(id)
);

create table insurance_products (
  id bigint unsigned auto_increment primary key,
  company_id bigint unsigned not null,
  product_name varchar(200) not null,
  category_id bigint unsigned null,
  sub_category_name varchar(100),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  unique key uk_company_product (company_id, product_name),
  constraint fk_insurance_products_company
    foreign key (company_id) references insurance_companies(id),
  constraint fk_insurance_products_category
    foreign key (category_id) references product_categories(id)
);

create table policy_families (
  id bigint unsigned auto_increment primary key,
  policy_family_code varchar(30) not null unique,
  customer_id bigint unsigned not null,
  family_label varchar(200),
  created_at datetime not null default current_timestamp,
  constraint fk_policy_families_customer
    foreign key (customer_id) references customers(id)
);

create table policies (
  id bigint unsigned auto_increment primary key,
  policy_code varchar(30) not null unique,
  policy_family_id bigint unsigned not null,
  previous_policy_id bigint unsigned null,
  customer_id bigint unsigned not null,
  company_id bigint unsigned not null,
  product_id bigint unsigned null,
  policy_number varchar(100) not null,
  old_policy_number varchar(100),
  previous_insurer_id bigint unsigned null,
  business_type varchar(30),
  policy_type varchar(30),
  sum_insured decimal(14,2),
  gross_premium decimal(14,2),
  net_premium decimal(14,2),
  issue_date date,
  risk_start_date date,
  risk_end_date date,
  vehicle_make varchar(100),
  vehicle_model varchar(100),
  year_of_manufacture int,
  registration_no varchar(50),
  ncb_percent decimal(5,2),
  producer_name varchar(150),
  delivery_mode varchar(50),
  delivery_by varchar(150),
  issued_by_agent_id bigint unsigned null,
  paid_by_type varchar(20),
  payment_mode varchar(30),
  agent_payment_account_id bigint unsigned null,
  payment_status varchar(30),
  client_payment_status varchar(30),
  payment_received_amount decimal(14,2) not null default 0,
  payment_pending_amount decimal(14,2) not null default 0,
  client_cheque_number varchar(50),
  client_cheque_date date,
  cheque_given_by_client_date date,
  client_payment_clearing_date date,
  payment_remarks text,
  renewal_status varchar(30),
  assigned_agent_id bigint unsigned null,
  target_insurer_id bigint unsigned null,
  renewal_business_type varchar(30),
  next_task varchar(150),
  next_follow_up_at datetime,
  last_follow_up_at datetime,
  last_client_response text,
  policy_status varchar(30),
  inactive_reason text,
  is_latest_in_family tinyint(1) not null default 1,
  last_status varchar(100),
  fiscal_year_ending int,
  remarks text,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  key idx_policies_family (policy_family_id),
  key idx_policies_customer (customer_id),
  key idx_policies_risk_end (risk_end_date),
  constraint fk_policies_family
    foreign key (policy_family_id) references policy_families(id),
  constraint fk_policies_previous
    foreign key (previous_policy_id) references policies(id),
  constraint fk_policies_customer
    foreign key (customer_id) references customers(id),
  constraint fk_policies_company
    foreign key (company_id) references insurance_companies(id),
  constraint fk_policies_product
    foreign key (product_id) references insurance_products(id),
  constraint fk_policies_previous_insurer
    foreign key (previous_insurer_id) references insurance_companies(id),
  constraint fk_policies_issued_by
    foreign key (issued_by_agent_id) references agents(id),
  constraint fk_policies_payment_account
    foreign key (agent_payment_account_id) references agent_payment_accounts(id),
  constraint fk_policies_assigned_agent
    foreign key (assigned_agent_id) references agents(id),
  constraint fk_policies_target_insurer
    foreign key (target_insurer_id) references insurance_companies(id)
);

create table follow_ups (
  id bigint unsigned auto_increment primary key,
  policy_id bigint unsigned not null,
  follow_up_type varchar(20) not null,
  follow_up_mode varchar(30) not null,
  follow_up_at datetime not null,
  response_summary text,
  next_follow_up_at datetime,
  done_by_agent_id bigint unsigned null,
  outcome_status varchar(30),
  created_at datetime not null default current_timestamp,
  constraint fk_follow_ups_policy
    foreign key (policy_id) references policies(id),
  constraint fk_follow_ups_agent
    foreign key (done_by_agent_id) references agents(id)
);

create table leads (
  id bigint unsigned auto_increment primary key,
  lead_date date not null,
  description text,
  due_date date,
  client_name varchar(150) not null,
  priority varchar(20) not null default 'Medium',
  assigned_to_user_id bigint unsigned null,
  category_id bigint unsigned null,
  sub_category_id bigint unsigned null,
  notes text,
  lead_status varchar(40) not null default 'Pending Assigning',
  latest_update_date date,
  next_follow_up_date date,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  key idx_leads_status (lead_status),
  key idx_leads_due_date (due_date),
  constraint fk_leads_assigned_user
    foreign key (assigned_to_user_id) references users(id),
  constraint fk_leads_category
    foreign key (category_id) references product_categories(id),
  constraint fk_leads_sub_category
    foreign key (sub_category_id) references product_categories(id)
);

create table lead_updates (
  id bigint unsigned auto_increment primary key,
  lead_id bigint unsigned not null,
  status varchar(20) not null,
  update_date date not null,
  update_by_user_id bigint unsigned not null,
  next_follow_up_date date,
  remarks text,
  created_at datetime not null default current_timestamp,
  key idx_lead_updates_date (update_date),
  constraint fk_lead_updates_user
    foreign key (update_by_user_id) references users(id),
  constraint fk_lead_updates_lead
    foreign key (lead_id) references leads(id)
);

create table tasks (
  id bigint unsigned auto_increment primary key,
  task_date date not null,
  description text,
  due_date date,
  client_name varchar(150) not null,
  priority varchar(20) not null default 'Medium',
  assigned_to_user_id bigint unsigned null,
  category_id bigint unsigned null,
  sub_category_id bigint unsigned null,
  notes text,
  task_status varchar(40) not null default 'Pending',
  latest_update_date date,
  next_follow_up_date date,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  key idx_tasks_status (task_status),
  key idx_tasks_due_date (due_date),
  constraint fk_tasks_assigned_user
    foreign key (assigned_to_user_id) references users(id),
  constraint fk_tasks_category
    foreign key (category_id) references product_categories(id),
  constraint fk_tasks_sub_category
    foreign key (sub_category_id) references product_categories(id)
);

create table task_updates (
  id bigint unsigned auto_increment primary key,
  task_id bigint unsigned not null,
  status varchar(20) not null,
  update_date date not null,
  update_by_user_id bigint unsigned not null,
  next_follow_up_date date,
  remarks text,
  created_at datetime not null default current_timestamp,
  key idx_task_updates_date (update_date),
  constraint fk_task_updates_user
    foreign key (update_by_user_id) references users(id),
  constraint fk_task_updates_task
    foreign key (task_id) references tasks(id)
);

create table client_payments (
  id bigint unsigned auto_increment primary key,
  policy_id bigint unsigned not null,
  payment_date date not null,
  amount decimal(14,2) not null,
  payment_mode varchar(30),
  payment_status varchar(20),
  agent_payment_account_id bigint unsigned null,
  cheque_number varchar(50),
  cheque_date date,
  clearing_date date,
  reference_number varchar(100),
  received_by_agent_id bigint unsigned null,
  remarks text,
  created_at datetime not null default current_timestamp,
  constraint fk_client_payments_policy
    foreign key (policy_id) references policies(id),
  constraint fk_client_payments_account
    foreign key (agent_payment_account_id) references agent_payment_accounts(id),
  constraint fk_client_payments_received_by
    foreign key (received_by_agent_id) references agents(id)
);

create table document_types (
  id bigint unsigned auto_increment primary key,
  code varchar(50) not null unique,
  name varchar(100) not null,
  entity_level varchar(30) not null,
  is_mandatory tinyint(1) not null default 0,
  is_active tinyint(1) not null default 1,
  sort_order int not null default 0,
  description text,
  created_at datetime not null default current_timestamp
);

create table settings (
  id bigint unsigned auto_increment primary key,
  organization_name varchar(150) not null,
  gst varchar(50),
  address text,
  logo varchar(255),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime null default null on update current_timestamp
);

create table documents (
  id bigint unsigned auto_increment primary key,
  document_type_id bigint unsigned not null,
  customer_id bigint unsigned null,
  policy_id bigint unsigned null,
  client_payment_id bigint unsigned null,
  file_name varchar(255) not null,
  stored_file_name varchar(255),
  file_url text not null,
  file_extension varchar(20),
  mime_type varchar(100),
  file_size_bytes bigint,
  document_number varchar(100),
  document_date date,
  expiry_date date,
  remarks text,
  uploaded_by_agent_id bigint unsigned null,
  uploaded_at datetime not null default current_timestamp,
  is_active tinyint(1) not null default 1,
  deleted_at datetime null,
  constraint fk_documents_type
    foreign key (document_type_id) references document_types(id),
  constraint fk_documents_customer
    foreign key (customer_id) references customers(id),
  constraint fk_documents_policy
    foreign key (policy_id) references policies(id),
  constraint fk_documents_payment
    foreign key (client_payment_id) references client_payments(id),
  constraint fk_documents_agent
    foreign key (uploaded_by_agent_id) references agents(id)
);

create table policy_status_history (
  id bigint unsigned auto_increment primary key,
  policy_id bigint unsigned not null,
  old_status varchar(30),
  new_status varchar(30),
  reason text,
  changed_by_agent_id bigint unsigned null,
  changed_at datetime not null default current_timestamp,
  constraint fk_policy_status_history_policy
    foreign key (policy_id) references policies(id),
  constraint fk_policy_status_history_agent
    foreign key (changed_by_agent_id) references agents(id)
);
