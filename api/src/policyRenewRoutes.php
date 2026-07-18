<?php

if ($path === '/api/policies/inactivated' && $method === 'GET') {
    $pdo = \App\Database::connection();
    $organizationId = requireOrganizationId();

    $statement = $pdo->prepare(
        'SELECT
            p.id,
            p.policy_number,
            p.issue_date,
            p.risk_end_date,
            p.policy_type,
            p.registration_no,
            p.policy_status,
            p.inactive_reason,
            c.full_name AS customer_name,
            c.mobile AS customer_mobile,
            cg.group_name AS customer_group_name,
            ic.company_name,
            ip.product_name
         FROM policies p
         LEFT JOIN customers c ON c.id = p.customer_id
         LEFT JOIN customer_groups cg ON cg.id = c.group_id
         LEFT JOIN insurance_companies ic ON ic.id = p.company_id
         LEFT JOIN insurance_products ip ON ip.id = p.product_id
         WHERE p.organization_id = :organization_id
           AND coalesce(p.policy_status, "") = "Inactive"
           AND coalesce(p.inactive_reason, "") <> ""
         ORDER BY p.risk_end_date DESC, p.policy_number ASC'
    );
    bindOrganizationId($statement, $organizationId);
    $statement->execute();

    \App\Response::json([
        'status' => 'ok',
        'data' => [
            'policies' => $statement->fetchAll(),
        ],
    ]);
    exit;
}

if ($path === '/api/policies/renew-import-template' && $method === 'GET') {
    $headers = [
        'customer_group_name',
        'customer_name',
        'customer_mobile',
        'policy_number',
        'previous_policy_number',
        'business_type',
        'policy_type',
        'company_name',
        'product_name',
        'issue_date',
        'risk_start_date',
        'risk_end_date',
        'sum_insured',
        'gross_premium',
        'net_premium',
        'vehicle_make',
        'vehicle_model',
        'year_of_manufacture',
        'registration_no',
        'paid_by_type',
        'agent_account_label',
        'payment_mode',
        'cheque_number',
        'cheque_date',
        'cheque_amount'
    ];

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="renew-policy-import-template.csv"');

    $output = fopen('php://output', 'w');
    fputcsv($output, $headers);
    fputcsv($output, [
        'Corporate Clients',
        'Amit Sharma',
        '9876543210',
        'POL-2025-001',
        'POL-2024-001',
        'Renewal',
        'Motor Comprehensive',
        'ABC Insurance Co',
        'Private Car Package',
        '2025-04-10',
        '2025-04-10',
        '2026-04-09',
        '500000',
        '18500',
        '17500',
        'Maruti',
        'Baleno',
        '2022',
        'KA01AB1234',
        'Client',
        '',
        'Online',
        '',
        '',
        ''
    ]);
    fclose($output);
    exit;
}

if (preg_match('#^/api/policies/(\d+)/inactivate$#', $path, $matches) === 1 && $method === 'POST') {
    $pdo = \App\Database::connection();
    $organizationId = requireOrganizationId();
    $payload = json_decode(file_get_contents('php://input') ?: '[]', true);

    if (!is_array($payload)) {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Invalid JSON payload.'
        ], 422);
        exit;
    }

    $reason = trim((string) ($payload['reason'] ?? ''));
    if ($reason === '') {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Inactivation reason is required.'
        ], 422);
        exit;
    }

    $policyId = (int) $matches[1];
    $policyStatement = $pdo->prepare(
        'SELECT id, policy_number, renewal_status, policy_status, inactive_reason
         FROM policies
         WHERE id = :id
           AND organization_id = :organization_id'
    );
    $policyStatement->bindValue(':id', $policyId, \PDO::PARAM_INT);
    bindOrganizationId($policyStatement, $organizationId);
    $policyStatement->execute();
    $policy = $policyStatement->fetch();

    if (!$policy) {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Policy not found.'
        ], 404);
        exit;
    }

    if (trim((string) ($policy['renewal_status'] ?? '')) === 'Renewed') {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Renewed policies cannot be marked inactive.'
        ], 422);
        exit;
    }

    if (trim((string) ($policy['policy_status'] ?? '')) === 'Inactive' && trim((string) ($policy['inactive_reason'] ?? '')) !== '') {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Policy is already inactive.'
        ], 409);
        exit;
    }

    $update = $pdo->prepare(
        'UPDATE policies
         SET policy_status = :policy_status,
             inactive_reason = :inactive_reason,
             last_status = :last_status
         WHERE id = :id
           AND organization_id = :organization_id'
    );
    $update->bindValue(':policy_status', 'Inactive');
    $update->bindValue(':inactive_reason', $reason);
    $update->bindValue(':last_status', 'Inactive');
    $update->bindValue(':id', $policyId, \PDO::PARAM_INT);
    bindOrganizationId($update, $organizationId);
    $update->execute();

    \App\Response::json([
        'status' => 'ok',
        'message' => 'Policy marked inactive successfully.'
    ]);
    exit;
}

if (preg_match('#^/api/policies/(\d+)/reactivate$#', $path, $matches) === 1 && $method === 'POST') {
    $pdo = \App\Database::connection();
    $organizationId = requireOrganizationId();
    $policyId = (int) $matches[1];

    $policyStatement = $pdo->prepare(
        'SELECT id, policy_status, inactive_reason
         FROM policies
         WHERE id = :id
           AND organization_id = :organization_id'
    );
    $policyStatement->bindValue(':id', $policyId, \PDO::PARAM_INT);
    bindOrganizationId($policyStatement, $organizationId);
    $policyStatement->execute();
    $policy = $policyStatement->fetch();

    if (!$policy) {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Policy not found.'
        ], 404);
        exit;
    }

    if (trim((string) ($policy['policy_status'] ?? '')) !== 'Inactive' || trim((string) ($policy['inactive_reason'] ?? '')) === '') {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Policy is not currently inactive.'
        ], 422);
        exit;
    }

    $update = $pdo->prepare(
        'UPDATE policies
         SET policy_status = :policy_status,
             inactive_reason = NULL,
             last_status = :last_status
         WHERE id = :id
           AND organization_id = :organization_id'
    );
    $update->bindValue(':policy_status', 'Active');
    $update->bindValue(':last_status', 'Active');
    $update->bindValue(':id', $policyId, \PDO::PARAM_INT);
    bindOrganizationId($update, $organizationId);
    $update->execute();

    \App\Response::json([
        'status' => 'ok',
        'message' => 'Policy reactivated successfully.'
    ]);
    exit;
}

if ($path === '/api/policies/renew-import' && $method === 'POST') {
    $pdo = \App\Database::connection();
    $organizationId = requireOrganizationId();

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Please upload a CSV file.'
        ], 422);
        exit;
    }

    $file = $_FILES['file'];
    if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Failed to upload the CSV file.'
        ], 422);
        exit;
    }

    $handle = fopen((string) $file['tmp_name'], 'r');
    if ($handle === false) {
        \App\Response::json([
            'status' => 'error',
            'message' => 'Unable to read the uploaded CSV file.'
        ], 422);
        exit;
    }

    $headers = fgetcsv($handle);
    if (!is_array($headers) || $headers === []) {
        fclose($handle);
        \App\Response::json([
            'status' => 'error',
            'message' => 'The uploaded CSV file is empty.'
        ], 422);
        exit;
    }

    $headers = array_map(static fn ($header): string => trim((string) $header), $headers);
    $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0] ?? '');

    $findMatches = static function (string $sql, array $bindings = []) use ($pdo, $organizationId): array {
        $statement = $pdo->prepare($sql);
        bindOrganizationId($statement, $organizationId);
        foreach ($bindings as $name => $value) {
            $statement->bindValue($name, $value);
        }
        $statement->execute();
        return $statement->fetchAll();
    };

    $findOneByName = static function (string $field, string $value, string $sql, array &$rowErrors, int $rowNumber) use ($findMatches): ?array {
        $matches = $findMatches($sql, [':lookup_value' => normalizeLookupValue($value)]);

        if ($matches === []) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => $field,
                'value' => $value,
                'message' => 'No matching record was found.'
            ];
            return null;
        }

        if (count($matches) > 1) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => $field,
                'value' => $value,
                'message' => 'Multiple matching records were found.'
            ];
            return null;
        }

        return $matches[0];
    };

    $resolveDuplicateCustomerByPreviousPolicy = static function (array $customerMatches, string $previousPolicyNumber) use ($findMatches): ?array {
        if ($previousPolicyNumber === '') {
            return null;
        }

        $previousMatches = $findMatches(
            'SELECT customer_id
             FROM policies
             WHERE organization_id = :organization_id
               AND lower(trim(policy_number)) = :lookup_value
             LIMIT 2',
            [':lookup_value' => normalizeLookupValue($previousPolicyNumber)]
        );

        if (count($previousMatches) !== 1) {
            return null;
        }

        $previousCustomerId = (int) ($previousMatches[0]['customer_id'] ?? 0);
        foreach ($customerMatches as $customerMatch) {
            if ((int) ($customerMatch['id'] ?? 0) === $previousCustomerId) {
                return $customerMatch;
            }
        }

        return null;
    };

    $findOrCreateCustomerGroup = static function (string $groupName) use ($pdo, $organizationId, $findMatches): ?array {
        $groupName = trim($groupName);
        $lookupValue = normalizeLookupValue($groupName);

        if ($lookupValue !== '' && $lookupValue !== '-') {
            $matches = $findMatches(
                'SELECT id, group_name FROM customer_groups WHERE organization_id = :organization_id AND lower(trim(group_name)) = :lookup_value LIMIT 1',
                [':lookup_value' => $lookupValue]
            );
            if ($matches !== []) {
                return $matches[0];
            }
        }

        $groupName = 'Ungroup';
        $matches = $findMatches(
            'SELECT id, group_name FROM customer_groups WHERE organization_id = :organization_id AND lower(trim(group_name)) = :lookup_value LIMIT 1',
            [':lookup_value' => normalizeLookupValue($groupName)]
        );
        if ($matches !== []) {
            return $matches[0];
        }

        $insert = $pdo->prepare(
            'INSERT INTO customer_groups (organization_id, group_name, notes) VALUES (:organization_id, :group_name, :notes)'
        );
        bindOrganizationId($insert, $organizationId);
        $insert->bindValue(':group_name', $groupName);
        $insert->bindValue(':notes', 'Created from renewal CSV import.');
        $insert->execute();

        return ['id' => (int) $pdo->lastInsertId(), 'group_name' => $groupName];
    };

    $findOrCreateInsuranceCompany = static function (string $companyName) use ($pdo, $organizationId, $findMatches): ?array {
        $companyName = trim($companyName);
        if ($companyName === '') {
            return null;
        }

        $matches = $findMatches(
            'SELECT id, company_name FROM insurance_companies WHERE organization_id = :organization_id AND lower(trim(company_name)) = :lookup_value LIMIT 1',
            [':lookup_value' => normalizeLookupValue($companyName)]
        );
        if ($matches !== []) {
            return $matches[0];
        }

        $insert = $pdo->prepare(
            'INSERT INTO insurance_companies (organization_id, company_name, is_active) VALUES (:organization_id, :company_name, 1)'
        );
        bindOrganizationId($insert, $organizationId);
        $insert->bindValue(':company_name', $companyName);
        $insert->execute();

        return ['id' => (int) $pdo->lastInsertId(), 'company_name' => $companyName];
    };

    $findOrCreatePolicyType = static function (string $policyTypeLabel) use ($pdo, $organizationId, $findMatches): ?array {
        $policyTypeLabel = trim($policyTypeLabel);
        if ($policyTypeLabel === '') {
            return null;
        }

        $matches = $findMatches(
            'SELECT id, category_name FROM product_categories WHERE organization_id = :organization_id AND lower(trim(category_name)) = :lookup_value LIMIT 1',
            [':lookup_value' => normalizeLookupValue($policyTypeLabel)]
        );
        if ($matches !== []) {
            return $matches[0];
        }

        $parentMatches = $findMatches(
            'SELECT id, category_name FROM product_categories WHERE organization_id = :organization_id AND lower(trim(category_name)) = :lookup_value LIMIT 1',
            [':lookup_value' => normalizeLookupValue('Imported Policy Types')]
        );

        if ($parentMatches === []) {
            $parentInsert = $pdo->prepare(
                'INSERT INTO product_categories (organization_id, category_name, parent_category_id, is_active) VALUES (:organization_id, :category_name, null, 1)'
            );
            bindOrganizationId($parentInsert, $organizationId);
            $parentInsert->bindValue(':category_name', 'Imported Policy Types');
            $parentInsert->execute();
            $parentId = (int) $pdo->lastInsertId();
        } else {
            $parentId = (int) $parentMatches[0]['id'];
        }

        $insert = $pdo->prepare(
            'INSERT INTO product_categories (organization_id, category_name, parent_category_id, is_active) VALUES (:organization_id, :category_name, :parent_category_id, 1)'
        );
        bindOrganizationId($insert, $organizationId);
        $insert->bindValue(':category_name', $policyTypeLabel);
        $insert->bindValue(':parent_category_id', $parentId, \PDO::PARAM_INT);
        $insert->execute();

        return ['id' => (int) $pdo->lastInsertId(), 'category_name' => $policyTypeLabel];
    };

    $findOrCreateCustomer = static function (string $customerName, string $customerMobile, ?array $group) use ($pdo, $organizationId, $findMatches): ?array {
        $customerName = trim($customerName);
        $customerMobile = trim($customerMobile);
        if ($customerName === '' && $customerMobile !== '') {
            $customerName = $customerMobile;
        }
        if ($customerName === '' || $group === null) {
            return null;
        }

        $matches = $findMatches(
            'SELECT c.id, c.group_id, c.full_name, c.mobile
             FROM customers c
             WHERE c.organization_id = :organization_id
               AND lower(trim(c.full_name)) = :lookup_value
               AND c.group_id = :group_id
             LIMIT 1',
            [':lookup_value' => normalizeLookupValue($customerName), ':group_id' => (int) $group['id']]
        );
        if ($matches !== []) {
            return $matches[0];
        }

        $insert = $pdo->prepare(
            'INSERT INTO customers (organization_id, customer_code, group_id, full_name, mobile, is_active, notes)
             VALUES (:organization_id, :customer_code, :group_id, :full_name, :mobile, 1, :notes)'
        );
        bindOrganizationId($insert, $organizationId);
        $insert->bindValue(':customer_code', generateCustomerCode($pdo, $organizationId));
        $insert->bindValue(':group_id', (int) $group['id'], \PDO::PARAM_INT);
        $insert->bindValue(':full_name', $customerName);
        $insert->bindValue(':mobile', $customerMobile !== '' ? $customerMobile : null);
        $insert->bindValue(':notes', 'Created from renewal CSV import.');
        $insert->execute();

        return [
            'id' => (int) $pdo->lastInsertId(),
            'group_id' => (int) $group['id'],
            'full_name' => $customerName,
            'mobile' => $customerMobile
        ];
    };

    $findOrCreateInsuranceProduct = static function (string $productName, ?array $company, ?array $policyType) use ($pdo, $organizationId, $findMatches): ?array {
        $productName = trim($productName);
        if ($productName === '' || $company === null) {
            return null;
        }

        $matches = $findMatches(
            'SELECT ip.id, ip.company_id, ip.category_id, ip.product_name, pc.category_name
             FROM insurance_products ip
             LEFT JOIN product_categories pc ON pc.id = ip.category_id
             WHERE ip.organization_id = :organization_id
               AND ip.company_id = :company_id
               AND lower(trim(ip.product_name)) = :lookup_value
             LIMIT 1',
            [':company_id' => (int) $company['id'], ':lookup_value' => normalizeLookupValue($productName)]
        );
        if ($matches !== []) {
            return $matches[0];
        }

        $insert = $pdo->prepare(
            'INSERT INTO insurance_products (organization_id, company_id, product_name, category_id, is_active)
             VALUES (:organization_id, :company_id, :product_name, :category_id, 1)'
        );
        bindOrganizationId($insert, $organizationId);
        $insert->bindValue(':company_id', (int) $company['id'], \PDO::PARAM_INT);
        $insert->bindValue(':product_name', $productName);
        $insert->bindValue(':category_id', $policyType !== null ? (int) $policyType['id'] : null, $policyType !== null ? \PDO::PARAM_INT : \PDO::PARAM_NULL);
        $insert->execute();

        return [
            'id' => (int) $pdo->lastInsertId(),
            'company_id' => (int) $company['id'],
            'category_id' => $policyType !== null ? (int) $policyType['id'] : null,
            'product_name' => $productName,
            'category_name' => $policyType['category_name'] ?? null
        ];
    };

    $totalRows = 0;
    $importedCount = 0;
    $importedWithWarningCount = 0;
    $errors = [];
    $warnings = [];
    $rowNumber = 1;

    while (($data = fgetcsv($handle)) !== false) {
        $rowNumber++;
        $row = [];
        foreach ($headers as $index => $header) {
            if ($header === '') {
                continue;
            }
            $row[$header] = trim((string) ($data[$index] ?? ''));
        }

        $hasContent = false;
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                $hasContent = true;
                break;
            }
        }

        if (!$hasContent) {
            continue;
        }

        $totalRows++;
        $rowErrors = [];
        $rowWarnings = [];

        $policyNumber = csvFieldValue($row, 'policy_number');
        $customerName = csvFieldValue($row, 'customer_name');
        $customerMobile = csvFieldValue($row, 'customer_mobile');
        $customerGroupName = csvFieldValue($row, 'customer_group_name');
        $customerGroupLookupValue = normalizeLookupValue($customerGroupName);
        $customerGroupWasProvided = !in_array($customerGroupLookupValue, ['', '-'], true);
        $companyName = csvFieldValue($row, 'company_name');
        $productName = csvFieldValue($row, 'product_name');
        $policyTypeLabel = csvFieldValue($row, 'policy_type');
        $previousPolicyNumber = csvFieldValue($row, 'previous_policy_number');
        $businessType = csvFieldValue($row, 'business_type');
        $paidByType = csvFieldValue($row, 'paid_by_type');
        $paymentMode = csvFieldValue($row, 'payment_mode');
        $agentAccountLabel = csvFieldValue($row, 'agent_account_label');
        $registrationNo = csvFieldValue($row, 'registration_no');
        $vehicleMake = csvFieldValue($row, 'vehicle_make');
        $vehicleModel = csvFieldValue($row, 'vehicle_model');
        $chequeNumber = csvFieldValue($row, 'cheque_number');
        $chequeDate = csvOptionalDateValue($row, 'cheque_date', $rowNumber, $rowErrors);
        $chequeAmount = csvOptionalNumericValue($row, 'cheque_amount', $rowNumber, $rowErrors);
        $issueDate = csvOptionalDateValue($row, 'issue_date', $rowNumber, $rowErrors);
        $riskStartDate = csvOptionalDateValue($row, 'risk_start_date', $rowNumber, $rowErrors);
        $riskEndDate = csvOptionalDateValue($row, 'risk_end_date', $rowNumber, $rowErrors);
        $sumInsured = csvOptionalNumericValue($row, 'sum_insured', $rowNumber, $rowErrors);
        $grossPremium = csvOptionalNumericValue($row, 'gross_premium', $rowNumber, $rowErrors);
        $netPremium = csvOptionalNumericValue($row, 'net_premium', $rowNumber, $rowErrors);
        $yearOfManufacture = csvOptionalIntegerValue($row, 'year_of_manufacture', $rowNumber, $rowErrors);

        if ($policyNumber === '') {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'policy_number',
                'value' => '',
                'message' => 'Policy number is required.'
            ];
        }
        if ($customerMobile === '' && $customerName === '') {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'customer_name',
                'value' => '',
                'message' => 'Provide customer mobile or customer name.'
            ];
        }
        if ($companyName === '') {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'company_name',
                'value' => '',
                'message' => 'Company name is required.'
            ];
        }
        if ($riskEndDate === null) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'risk_end_date',
                'value' => csvFieldValue($row, 'risk_end_date'),
                'message' => 'Risk expiry date is required in YYYY-MM-DD format.'
            ];
        }
        if ($issueDate !== null && $riskEndDate !== null && $riskEndDate < $issueDate) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'risk_end_date',
                'value' => csvFieldValue($row, 'risk_end_date'),
                'message' => 'Risk expiry date must be greater than or equal to policy issued date.'
            ];
        }

        if ($rowErrors !== []) {
            $errors = array_merge($errors, $rowErrors);
            continue;
        }

        $existingPolicy = $findMatches(
            'SELECT id FROM policies WHERE organization_id = :organization_id AND lower(trim(policy_number)) = :lookup_value LIMIT 2',
            [':lookup_value' => normalizeLookupValue($policyNumber)]
        );
        if ($existingPolicy !== []) {
            $errors[] = [
                'row' => $rowNumber,
                'field' => 'policy_number',
                'value' => $policyNumber,
                'message' => 'A policy with this policy number already exists.'
            ];
            continue;
        }
        $group = $findOrCreateCustomerGroup($customerGroupName);
        $customerGroupMatchedCsv = $customerGroupWasProvided
            && $group !== null
            && normalizeLookupValue($group['group_name'] ?? '') === $customerGroupLookupValue;

        $customer = null;
        if ($customerMobile !== '') {
            $customerMatches = $findMatches(
                'SELECT c.id, c.group_id, c.full_name, c.mobile
                 FROM customers c
                 WHERE c.organization_id = :organization_id
                   AND lower(trim(coalesce(c.mobile, ""))) = :lookup_value',
                [':lookup_value' => normalizeLookupValue($customerMobile)]
            );

            if ($customerMatches === []) {
                if ($customerName === '') {
                    $customer = $findOrCreateCustomer($customerName, $customerMobile, $group);
                }
            } elseif (count($customerMatches) > 1) {
                $customer = $resolveDuplicateCustomerByPreviousPolicy($customerMatches, $previousPolicyNumber) ?? $customerMatches[0];
            } elseif (count($customerMatches) === 1) {
                $customer = $customerMatches[0];
            }
        }

        if ($customer === null && $customerName !== '') {
            $customerMatches = $findMatches(
                'SELECT c.id, c.group_id, c.full_name, c.mobile
                 FROM customers c
                 WHERE c.organization_id = :organization_id
                   AND lower(trim(c.full_name)) = :lookup_value',
                [':lookup_value' => normalizeLookupValue($customerName)]
            );

            if ($customerMatches === []) {
                $customer = $findOrCreateCustomer($customerName, $customerMobile, $group);

                if ($customer === null) {
                    $rowErrors[] = [
                        'row' => $rowNumber,
                        'field' => 'customer_name',
                        'value' => $customerName,
                        'message' => 'No matching customer was found and the row did not include enough data to create one.'
                    ];
                }
            } elseif (count($customerMatches) > 1) {
                $customer = $resolveDuplicateCustomerByPreviousPolicy($customerMatches, $previousPolicyNumber) ?? $customerMatches[0];
            } else {
                $customer = $customerMatches[0];
            }
        }

        if ($customer !== null && $customerName !== '' && normalizeLookupValue($customer['full_name'] ?? '') !== normalizeLookupValue($customerName)) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'customer_name',
                'value' => $customerName,
                'message' => 'Customer name does not match the resolved customer record.'
            ];
        }

        if ($customerGroupMatchedCsv && $customer !== null && (int) ($customer['group_id'] ?? 0) !== (int) $group['id']) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'customer_group_name',
                'value' => $customerGroupName,
                'message' => 'Customer group does not match the resolved customer.'
            ];
        }

        $company = $findOrCreateInsuranceCompany($companyName);
        $policyType = $findOrCreatePolicyType($policyTypeLabel);
        $product = $findOrCreateInsuranceProduct($productName, $company, $policyType);

        if ($policyType === null && $product !== null && trim((string) ($product['category_name'] ?? '')) !== '') {
            $policyType = [
                'id' => (int) ($product['category_id'] ?? 0),
                'category_name' => $product['category_name']
            ];
        }

        $agentAccount = null;
        if ($agentAccountLabel !== '') {
            $agentAccount = $findOneByName(
                'agent_account_label',
                $agentAccountLabel,
                'SELECT id, account_label FROM agent_payment_accounts WHERE organization_id = :organization_id AND lower(trim(account_label)) = :lookup_value',
                $rowErrors,
                $rowNumber
            );
        }

        $previousPolicy = null;
        $shouldLinkPrevious = false;
        if ($previousPolicyNumber !== '') {
            $previousMatches = $findMatches(
                'SELECT id, customer_id, company_id, policy_family_id, renewal_status, policy_status, inactive_reason
                 FROM policies
                 WHERE organization_id = :organization_id
                   AND lower(trim(policy_number)) = :lookup_value',
                [':lookup_value' => normalizeLookupValue($previousPolicyNumber)]
            );

            if ($previousMatches === []) {
                $rowWarnings[] = [
                    'row' => $rowNumber,
                    'field' => 'previous_policy_number',
                    'value' => $previousPolicyNumber,
                    'message' => 'Previous policy was not found. Imported as a standalone current policy.'
                ];
            } elseif (count($previousMatches) > 1) {
                $rowErrors[] = [
                    'row' => $rowNumber,
                    'field' => 'previous_policy_number',
                    'value' => $previousPolicyNumber,
                    'message' => 'Multiple previous policies matched this value.'
                ];
            } else {
                $previousPolicy = $previousMatches[0];
                $shouldLinkPrevious = true;
            }
        }

        if ($customer === null) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'customer_name',
                'value' => $customerName ?: $customerMobile,
                'message' => 'Customer could not be resolved.'
            ];
        }

        if ($shouldLinkPrevious && $previousPolicy !== null && $customer !== null && (int) $previousPolicy['customer_id'] !== (int) $customer['id']) {
            $rowErrors[] = [
                'row' => $rowNumber,
                'field' => 'previous_policy_number',
                'value' => $previousPolicyNumber,
                'message' => 'Previous policy belongs to a different customer.'
            ];
        }


        if ($rowErrors !== []) {
            $errors = array_merge($errors, $rowErrors);
            continue;
        }
        $pdo->beginTransaction();

        try {
            if (!$customerGroupWasProvided && $customer !== null && empty($customer['group_id']) && $group !== null) {
                $assignDefaultGroup = $pdo->prepare(
                    'UPDATE customers SET group_id = :group_id WHERE id = :id AND organization_id = :organization_id AND group_id IS NULL'
                );
                $assignDefaultGroup->bindValue(':group_id', (int) $group['id'], \PDO::PARAM_INT);
                $assignDefaultGroup->bindValue(':id', (int) $customer['id'], \PDO::PARAM_INT);
                bindOrganizationId($assignDefaultGroup, $organizationId);
                $assignDefaultGroup->execute();
                $customer['group_id'] = (int) $group['id'];
            }

            $policyFamilyId = null;
            $previousPolicyId = null;
            $lastStatus = $shouldLinkPrevious ? 'Renewed' : 'Issued';
            $policyTypeName = $policyType['category_name'] ?? null;
            $fiscalYearEnding = (int) date('Y');
            if ($issueDate !== null) {
                $fiscalYearEnding = (int) substr($issueDate, 0, 4);
            }

            if ($shouldLinkPrevious && $previousPolicy !== null) {
                $successorCountStatement = $pdo->prepare(
                    'SELECT count(*)
                     FROM policies
                     WHERE previous_policy_id = :previous_policy_id
                       AND organization_id = :organization_id'
                );
                $successorCountStatement->bindValue(':previous_policy_id', (int) $previousPolicy['id'], \PDO::PARAM_INT);
                bindOrganizationId($successorCountStatement, $organizationId);
                $successorCountStatement->execute();

                if ((int) $successorCountStatement->fetchColumn() > 0) {
                    throw new \RuntimeException('Previous policy is already linked to another renewal.');
                }

                if (trim((string) ($previousPolicy['renewal_status'] ?? '')) === 'Renewed') {
                    throw new \RuntimeException('Previous policy is already marked as renewed.');
                }

                if (trim((string) ($previousPolicy['policy_status'] ?? '')) === 'Inactive' || trim((string) ($previousPolicy['inactive_reason'] ?? '')) !== '') {
                    throw new \RuntimeException('Previous policy is inactive and cannot be linked for renewal.');
                }

                $policyFamilyId = !empty($previousPolicy['policy_family_id'])
                    ? (int) $previousPolicy['policy_family_id']
                    : createPolicyFamily($pdo, $organizationId, (int) $customer['id'], $previousPolicyNumber);

                if (empty($previousPolicy['policy_family_id'])) {
                    $updatePreviousFamily = $pdo->prepare(
                        'UPDATE policies
                         SET policy_family_id = :policy_family_id
                         WHERE id = :id
                           AND organization_id = :organization_id'
                    );
                    $updatePreviousFamily->bindValue(':policy_family_id', $policyFamilyId, \PDO::PARAM_INT);
                    $updatePreviousFamily->bindValue(':id', (int) $previousPolicy['id'], \PDO::PARAM_INT);
                    bindOrganizationId($updatePreviousFamily, $organizationId);
                    $updatePreviousFamily->execute();
                }

                $previousPolicyId = (int) $previousPolicy['id'];
            } else {
                $policyFamilyId = createPolicyFamily($pdo, $organizationId, (int) $customer['id'], $policyNumber);
            }

            $statement = $pdo->prepare(
                'INSERT INTO policies (
                    organization_id,
                    policy_code,
                    policy_family_id,
                    previous_policy_id,
                    customer_id,
                    company_id,
                    product_id,
                    policy_number,
                    business_type,
                    policy_type,
                    sum_insured,
                    gross_premium,
                    net_premium,
                    issue_date,
                    risk_start_date,
                    risk_end_date,
                    vehicle_make,
                    vehicle_model,
                    year_of_manufacture,
                    registration_no,
                    paid_by_type,
                    payment_mode,
                    agent_payment_account_id,
                    payment_status,
                    client_payment_status,
                    payment_received_amount,
                    payment_pending_amount,
                    client_cheque_number,
                    client_cheque_date,
                    payment_remarks,
                    renewal_status,
                    policy_status,
                    inactive_reason,
                    is_latest_in_family,
                    last_status,
                    fiscal_year_ending
                 ) VALUES (
                    :organization_id,
                    :policy_code,
                    :policy_family_id,
                    :previous_policy_id,
                    :customer_id,
                    :company_id,
                    :product_id,
                    :policy_number,
                    :business_type,
                    :policy_type,
                    :sum_insured,
                    :gross_premium,
                    :net_premium,
                    :issue_date,
                    :risk_start_date,
                    :risk_end_date,
                    :vehicle_make,
                    :vehicle_model,
                    :year_of_manufacture,
                    :registration_no,
                    :paid_by_type,
                    :payment_mode,
                    :agent_payment_account_id,
                    :payment_status,
                    :client_payment_status,
                    :payment_received_amount,
                    :payment_pending_amount,
                    :client_cheque_number,
                    :client_cheque_date,
                    :payment_remarks,
                    :renewal_status,
                    :policy_status,
                    :inactive_reason,
                    :is_latest_in_family,
                    :last_status,
                    :fiscal_year_ending
                 )'
            );

            bindOrganizationId($statement, $organizationId);
            $statement->bindValue(':policy_code', generatePolicyCode());
            $statement->bindValue(':policy_family_id', $policyFamilyId, \PDO::PARAM_INT);
            $statement->bindValue(':previous_policy_id', $previousPolicyId, $previousPolicyId === null ? \PDO::PARAM_NULL : \PDO::PARAM_INT);
            $statement->bindValue(':customer_id', (int) $customer['id'], \PDO::PARAM_INT);
            $statement->bindValue(':company_id', (int) $company['id'], \PDO::PARAM_INT);
            $statement->bindValue(':product_id', $product !== null ? (int) $product['id'] : null, $product !== null ? \PDO::PARAM_INT : \PDO::PARAM_NULL);
            $statement->bindValue(':policy_number', $policyNumber);
            $statement->bindValue(':business_type', $businessType !== '' ? $businessType : null);
            $statement->bindValue(':policy_type', $policyTypeName);
            $statement->bindValue(':sum_insured', $sumInsured);
            $statement->bindValue(':gross_premium', $grossPremium);
            $statement->bindValue(':net_premium', $netPremium);
            $statement->bindValue(':issue_date', $issueDate, $issueDate === null ? \PDO::PARAM_NULL : \PDO::PARAM_STR);
            $statement->bindValue(':risk_start_date', $riskStartDate, $riskStartDate === null ? \PDO::PARAM_NULL : \PDO::PARAM_STR);
            $statement->bindValue(':risk_end_date', $riskEndDate, $riskEndDate === null ? \PDO::PARAM_NULL : \PDO::PARAM_STR);
            $statement->bindValue(':vehicle_make', $vehicleMake !== '' ? $vehicleMake : null);
            $statement->bindValue(':vehicle_model', $vehicleModel !== '' ? $vehicleModel : null);
            $statement->bindValue(':year_of_manufacture', $yearOfManufacture, $yearOfManufacture === null ? \PDO::PARAM_NULL : \PDO::PARAM_INT);
            $statement->bindValue(':registration_no', $registrationNo !== '' ? $registrationNo : null);
            $statement->bindValue(':paid_by_type', $paidByType !== '' ? $paidByType : null);
            $statement->bindValue(':payment_mode', $paymentMode !== '' ? $paymentMode : null);
            $statement->bindValue(':agent_payment_account_id', $agentAccount !== null ? (int) $agentAccount['id'] : null, $agentAccount !== null ? \PDO::PARAM_INT : \PDO::PARAM_NULL);
            $statement->bindValue(':payment_status', 'Pending');
            $statement->bindValue(':client_payment_status', 'Pending');
            $statement->bindValue(':payment_received_amount', 0);
            $statement->bindValue(':payment_pending_amount', $netPremium ?? 0);
            $statement->bindValue(':client_cheque_number', $chequeNumber !== '' ? $chequeNumber : null);
            $statement->bindValue(':client_cheque_date', $chequeDate, $chequeDate === null ? \PDO::PARAM_NULL : \PDO::PARAM_STR);
            $statement->bindValue(':payment_remarks', $chequeAmount !== null ? sprintf('Imported cheque amount: %s', $chequeAmount) : null);
            $statement->bindValue(':renewal_status', null, \PDO::PARAM_NULL);
            $statement->bindValue(':policy_status', 'Active');
            $statement->bindValue(':inactive_reason', null, \PDO::PARAM_NULL);
            $statement->bindValue(':is_latest_in_family', 1, \PDO::PARAM_INT);
            $statement->bindValue(':last_status', $lastStatus);
            $statement->bindValue(':fiscal_year_ending', $fiscalYearEnding, \PDO::PARAM_INT);
            $statement->execute();

            if ($shouldLinkPrevious && $previousPolicyId !== null) {
                $updatePrevious = $pdo->prepare(
                    'UPDATE policies
                     SET is_latest_in_family = 0,
                         renewal_status = :renewal_status,
                         last_status = :last_status
                     WHERE id = :id
                       AND organization_id = :organization_id'
                );
                $updatePrevious->bindValue(':renewal_status', 'Renewed');
                $updatePrevious->bindValue(':last_status', 'Superseded');
                $updatePrevious->bindValue(':id', $previousPolicyId, \PDO::PARAM_INT);
                bindOrganizationId($updatePrevious, $organizationId);
                $updatePrevious->execute();
            }

            $pdo->commit();
            $importedCount++;

            if ($rowWarnings !== []) {
                $importedWithWarningCount++;
                $warnings = array_merge($warnings, $rowWarnings);
            }
        } catch (\Throwable $throwable) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            $errors[] = [
                'row' => $rowNumber,
                'field' => 'row',
                'value' => $policyNumber,
                'message' => $throwable->getMessage()
            ];
        }
    }

    fclose($handle);

    $failedRows = [];
    foreach ($errors as $error) {
        $failedRows[(int) ($error['row'] ?? 0)] = true;
    }

    \App\Response::json([
        'status' => 'ok',
        'message' => 'Renewal import processed.',
        'data' => [
            'total_rows' => $totalRows,
            'imported_count' => $importedCount,
            'imported_with_warning_count' => $importedWithWarningCount,
            'failed_count' => count($failedRows),
            'warnings' => $warnings,
            'errors' => $errors,
        ],
    ]);
    exit;
}


