<?php

declare(strict_types=1);

namespace App;

final class MasterRegistry
{
    public static function all(): array
    {
        $resources = [
            'organizations' => [
                'table' => 'organizations',
                'select' => 'o.id, o.organization_code, o.organization_name, s.gst, s.address, s.logo, o.is_active, o.created_at',
                'from' => 'organizations o left join settings s on s.id = (select s2.id from settings s2 where s2.organization_id = o.id order by s2.is_active desc, s2.id desc limit 1)',
                'order_by' => 'o.organization_name asc',
                'write_columns' => ['organization_code', 'organization_name', 'gst', 'address', 'logo', 'is_active'],
                'required' => ['organization_code', 'organization_name'],
                'nullable' => ['gst', 'address', 'logo'],
                'boolean' => ['is_active'],
                'file_columns' => ['logo'],
                'duplicate_keys' => [
                    ['columns' => ['organization_code'], 'label' => 'Organization Id', 'display_column' => 'organization_code'],
                ],
                'organization_owned' => false,
            ],
            'customer-groups' => [
                'table' => 'customer_groups',
                'select' => 'cg.id, cg.group_name, cg.notes, cg.created_at',
                'from' => 'customer_groups cg',
                'order_by' => 'cg.group_name asc',
                'search_columns' => ['cg.group_name', 'cg.notes'],
                'write_columns' => ['group_name', 'notes'],
                'required' => ['group_name'],
                'nullable' => ['notes'],
                'duplicate_keys' => [
                    ['columns' => ['group_name'], 'label' => 'Group Name', 'display_column' => 'group_name'],
                ],
                'organization_scope_column' => 'cg.organization_id',
            ],
            'customers' => [
                'table' => 'customers',
                'select' => 'c.id, c.group_id, c.full_name, c.mobile, c.alternate_mobile, c.email, c.city, c.state, c.gstin, c.drive_link, c.notes, c.is_active, c.created_at, cg.group_name',
                'from' => 'customers c left join customer_groups cg on cg.id = c.group_id',
                'order_by' => 'c.id desc',
                'search_columns' => ['c.full_name', 'cg.group_name', 'c.mobile', 'c.email', 'c.city', 'c.state', 'c.gstin', 'c.drive_link'],
                'write_columns' => [
                    'group_id',
                    'full_name',
                    'mobile',
                    'alternate_mobile',
                    'email',
                    'date_of_birth',
                    'anniversary_date',
                    'pan',
                    'aadhaar',
                    'gstin',
                    'father_name',
                    'address_line_1',
                    'address_line_2',
                    'address_line_3',
                    'city',
                    'state',
                    'pincode',
                    'drive_link',
                    'is_active',
                    'notes'
                ],
                'required' => ['group_id', 'full_name'],
                'nullable' => [
                    'alternate_mobile',
                    'email',
                    'date_of_birth',
                    'anniversary_date',
                    'pan',
                    'aadhaar',
                    'gstin',
                    'father_name',
                    'address_line_1',
                    'address_line_2',
                    'address_line_3',
                    'city',
                    'state',
                    'pincode',
                    'drive_link',
                    'notes'
                ],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    [
                        'columns' => ['full_name', 'mobile'],
                        'label' => 'Customer Name and Mobile',
                        'display_column' => 'mobile'
                    ],
                ],
                'organization_scope_column' => 'c.organization_id',
            ],
            'insurance-companies' => [
                'table' => 'insurance_companies',
                'select' => 'ic.id, ic.company_name, ic.company_short_name, ic.company_type, ic.is_active, ic.created_at',
                'from' => 'insurance_companies ic',
                'order_by' => 'ic.company_name asc',
                'write_columns' => ['company_name', 'company_short_name', 'company_type', 'is_active'],
                'required' => ['company_name'],
                'nullable' => ['company_short_name', 'company_type'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['company_name'], 'label' => 'Company Name', 'display_column' => 'company_name'],
                ],
                'organization_scope_column' => 'ic.organization_id',
            ],
            'states' => [
                'table' => 'states',
                'select' => 's.id, s.state_name, s.state_code, s.is_active, s.created_at',
                'from' => 'states s',
                'order_by' => 's.state_name asc',
                'write_columns' => ['state_name', 'state_code', 'is_active'],
                'required' => ['state_name'],
                'nullable' => ['state_code'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['state_name'], 'label' => 'State Name', 'display_column' => 'state_name'],
                ],
                'organization_scope_column' => 's.organization_id',
            ],
            'cities' => [
                'table' => 'cities',
                'select' => 'c.id, c.city_name, c.city_code, c.state_id, s.state_name, c.is_active, c.created_at',
                'from' => 'cities c left join states s on s.id = c.state_id',
                'order_by' => 's.state_name asc, c.city_name asc',
                'write_columns' => ['state_id', 'city_name', 'city_code', 'is_active'],
                'required' => ['state_id', 'city_name'],
                'nullable' => ['city_code'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['state_id', 'city_name'], 'label' => 'City Name', 'display_column' => 'city_name'],
                ],
                'organization_scope_column' => 'c.organization_id',
            ],
            'product-categories' => [
                'table' => 'product_categories',
                'select' => 'pc.id, pc.category_name, pc.parent_category_id, parent.category_name as parent_category_name, pc.is_active, pc.created_at',
                'from' => 'product_categories pc left join product_categories parent on parent.id = pc.parent_category_id',
                'order_by' => 'pc.category_name asc',
                'write_columns' => ['category_name', 'parent_category_id', 'is_active'],
                'required' => ['category_name'],
                'nullable' => ['parent_category_id'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['category_name'], 'label' => 'Category Name', 'display_column' => 'category_name'],
                ],
                'organization_scope_column' => 'pc.organization_id',
            ],
            'insurance-products' => [
                'table' => 'insurance_products',
                'select' => 'ip.id, ip.product_name, ip.sub_category_name, ip.is_active, ip.created_at, ic.company_name, pc.category_name, ip.company_id, ip.category_id',
                'from' => 'insurance_products ip left join insurance_companies ic on ic.id = ip.company_id left join product_categories pc on pc.id = ip.category_id',
                'order_by' => 'ip.id desc',
                'write_columns' => ['company_id', 'product_name', 'category_id', 'sub_category_name', 'is_active'],
                'required' => ['company_id', 'product_name'],
                'nullable' => ['category_id', 'sub_category_name'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['company_id', 'product_name'], 'label' => 'Product Name', 'display_column' => 'product_name'],
                ],
                'organization_scope_column' => 'ip.organization_id',
            ],
            'document-types' => [
                'table' => 'document_types',
                'select' => 'dt.id, dt.name, dt.entity_level, dt.is_active, dt.description, dt.created_at',
                'from' => 'document_types dt',
                'order_by' => 'dt.name asc',
                'write_columns' => ['name', 'entity_level', 'is_active', 'description'],
                'required' => ['name', 'entity_level'],
                'nullable' => ['description'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['name'], 'label' => 'Name', 'display_column' => 'name'],
                ],
                'organization_scope_column' => 'dt.organization_id',
            ],
            'users' => [
                'table' => 'users',
                'select' => 'u.id, u.full_name, u.login_id, u.password, u.views, u.add_permissions, u.edit_permissions, u.delete_permissions, u.email, u.mobile, u.role_name, u.is_active, u.created_at, u.linked_agent_id, a.full_name as linked_agent_name',
                'from' => 'users u left join agents a on a.id = u.linked_agent_id',
                'order_by' => 'u.id desc',
                'write_columns' => ['full_name', 'login_id', 'password', 'views', 'add_permissions', 'edit_permissions', 'delete_permissions', 'email', 'mobile', 'role_name', 'linked_agent_id', 'notes', 'is_active'],
                'required' => ['full_name', 'login_id', 'password', 'views', 'email', 'role_name'],
                'nullable' => ['mobile', 'linked_agent_id', 'notes'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['login_id'], 'label' => 'Log In Id', 'display_column' => 'login_id'],
                    ['columns' => ['email'], 'label' => 'Email', 'display_column' => 'email'],
                ],
                'organization_scope_column' => 'u.organization_id',
            ],
            'agents' => [
                'table' => 'agents',
                'select' => 'a.id, a.employee_code, a.full_name, a.mobile, a.email, a.is_active, a.created_at',
                'from' => 'agents a',
                'order_by' => 'a.id desc',
                'write_columns' => ['employee_code', 'full_name', 'mobile', 'email', 'is_active'],
                'required' => ['employee_code', 'full_name'],
                'nullable' => ['mobile', 'email'],
                'boolean' => ['is_active'],
                'duplicate_keys' => [
                    ['columns' => ['employee_code'], 'label' => 'Employee Code', 'display_column' => 'employee_code'],
                ],
                'organization_scope_column' => 'a.organization_id',
            ],
            'agent-accounts' => [
                'table' => 'agent_payment_accounts',
                'select' => 'apa.id, apa.agent_id, a.full_name as agent_name, apa.account_label, apa.account_type, apa.bank_name, apa.account_holder_name, apa.masked_account_number, apa.card_last4, apa.upi_id, apa.branch_name, apa.is_default, apa.is_active, apa.notes, apa.created_at',
                'from' => 'agent_payment_accounts apa left join agents a on a.id = apa.agent_id',
                'order_by' => 'apa.id desc',
                'write_columns' => [
                    'agent_id',
                    'account_label',
                    'account_type',
                    'bank_name',
                    'account_holder_name',
                    'masked_account_number',
                    'card_last4',
                    'upi_id',
                    'branch_name',
                    'is_default',
                    'is_active',
                    'notes'
                ],
                'required' => ['agent_id', 'account_label', 'account_type'],
                'nullable' => ['bank_name', 'account_holder_name', 'masked_account_number', 'card_last4', 'upi_id', 'branch_name', 'notes'],
                'boolean' => ['is_default', 'is_active'],
                'duplicate_keys' => [
                    ['columns' => ['agent_id', 'account_label'], 'label' => 'Account Label', 'display_column' => 'account_label'],
                ],
                'organization_scope_column' => 'apa.organization_id',
            ],
];

        foreach ($resources as $key => $config) {
            if (!array_key_exists('organization_owned', $config)) {
                $resources[$key]['organization_owned'] = true;
            }
        }

        return $resources;
    }
}
