<?php
declare(strict_types=1);

// Call tracking is organization-scoped and does not change existing business tables.
function handleCallingRoutes(string $path, string $method): bool {
    if (!str_starts_with($path, '/api/calling/')) return false;
    $pdo = \App\Database::connection();
    $org = requireOrganizationId();
    $pdo->exec("CREATE TABLE IF NOT EXISTS calling_entries (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT NOT NULL,
        assigned_user_id BIGINT NOT NULL,
        customer_id BIGINT NULL,
        customer_name VARCHAR(255) NOT NULL,
        mobile VARCHAR(30) DEFAULT NULL,
        call_type VARCHAR(20) NOT NULL DEFAULT 'New',
        scheduled_date DATE NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        outcome VARCHAR(40) DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        next_followup_date DATE DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_org_user_date (organization_id, assigned_user_id, scheduled_date),
        INDEX idx_org_followup (organization_id, next_followup_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS calling_incentive_rules (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT NOT NULL,
        rule_type VARCHAR(40) NOT NULL,
        rate DECIMAL(12,2) NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_org_rule (organization_id, rule_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS calling_settings (
        organization_id BIGINT PRIMARY KEY,
        daily_target INT NOT NULL DEFAULT 30
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $route = substr($path, strlen('/api/calling/'));
    if ($route === 'users' && $method === 'GET') {
        $q = $pdo->prepare('SELECT id, full_name FROM users WHERE organization_id = ? ORDER BY full_name');
        $q->execute([$org]); \App\Response::json(['data' => $q->fetchAll(PDO::FETCH_ASSOC)]); return true;
    }
    if ($route === 'settings') {
        if ($method === 'POST') {
            $target = max(1, min(1000, (int)($body['daily_target'] ?? 30)));
            $q=$pdo->prepare('INSERT INTO calling_settings (organization_id,daily_target) VALUES (?,?) ON DUPLICATE KEY UPDATE daily_target=VALUES(daily_target)');
            $q->execute([$org,$target]);
            foreach (($body['rules'] ?? []) as $type=>$rule) {
                if (!in_array($type,['attempted','connected','interested','followup','converted','premium_percent','target_bonus','monthly_bonus'],true)) continue;
                $q=$pdo->prepare('INSERT INTO calling_incentive_rules (organization_id,rule_type,rate,enabled) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rate=VALUES(rate),enabled=VALUES(enabled)');
                $q->execute([$org,$type,max(0,(float)($rule['rate']??0)),!empty($rule['enabled'])?1:0]);
            }
        }
        $q=$pdo->prepare('SELECT daily_target FROM calling_settings WHERE organization_id=?');$q->execute([$org]);
        $target=$q->fetchColumn();
        $q=$pdo->prepare('SELECT rule_type,rate,enabled FROM calling_incentive_rules WHERE organization_id=?');$q->execute([$org]);
        \App\Response::json(['data'=>['daily_target'=>$target===false?30:(int)$target,'rules'=>$q->fetchAll(PDO::FETCH_ASSOC)]]);return true;
    }
    if ($route === 'entries' && $method === 'POST') {
        $user=(int)($body['assigned_user_id']??0);
        $name=trim((string)($body['customer_name']??''));
        $date=(string)($body['scheduled_date']??'');
        if (!$user || !$name || !preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)) {
            \App\Response::json(['message'=>'Employee, customer and valid date are required.'],422);return true;
        }
        $q=$pdo->prepare('SELECT count(*) FROM users WHERE id=? AND organization_id=?');$q->execute([$user,$org]);
        if (!(int)$q->fetchColumn()) { \App\Response::json(['message'=>'Invalid employee.'],422);return true; }
        $q=$pdo->prepare('INSERT INTO calling_entries (organization_id,assigned_user_id,customer_id,customer_name,mobile,call_type,scheduled_date) VALUES (?,?,?,?,?,?,?)');
        $q->execute([$org,$user,!empty($body['customer_id'])?(int)$body['customer_id']:null,$name,(string)($body['mobile']??''),($body['call_type']??'New')==='Follow-up'?'Follow-up':'New',$date]);
        \App\Response::json(['data'=>['id'=>$pdo->lastInsertId()]],201);return true;
    }
    if (preg_match('~^entries/(\\d+)$~',$route,$m) && $method === 'PATCH') {
        $id=(int)$m[1];
        $user=(int)($body['assigned_user_id']??0);
        $name=trim((string)($body['customer_name']??''));
        $date=(string)($body['scheduled_date']??'');
        if (!$user || !$name || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$date) || !checkdate((int)substr($date,5,2),(int)substr($date,8,2),(int)substr($date,0,4))) {
            \\App\\Response::json(['message'=>'Employee, customer and valid date are required.'],422);return true;
        }
        $q=$pdo->prepare('SELECT COUNT(*) FROM users WHERE id=? AND organization_id=?');$q->execute([$user,$org]);
        if (!(int)$q->fetchColumn()) { \\App\\Response::json(['message'=>'Invalid employee.'],422);return true; }
        $q=$pdo->prepare('UPDATE calling_entries SET assigned_user_id=?,customer_id=?,customer_name=?,mobile=?,call_type=?,scheduled_date=? WHERE id=? AND organization_id=?');
        $q->execute([$user,!empty($body['customer_id'])?(int)$body['customer_id']:null,$name,(string)($body['mobile']??''),($body['call_type']??'New')==='Follow-up'?'Follow-up':'New',$date,$id,$org]);
        \\App\\Response::json(['status'=>'ok']);return true;
    }
    if (preg_match('~^entries/(\\d+)$~',$route,$m) && $method === 'DELETE') {
        $q=$pdo->prepare('DELETE FROM calling_entries WHERE id=? AND organization_id=?');
        $q->execute([(int)$m[1],$org]);
        if (!$q->rowCount()) { \\App\\Response::json(['message'=>'Call not found.'],404);return true; }
        \\App\\Response::json(['status'=>'ok']);return true;
    }
    if (preg_match('~^entries/(\d+)$~',$route,$m) && $method === 'PUT') {
        $status=(string)($body['status']??'');
        $valid=['Connected','Not Answered','Busy','Switched Off','Wrong Number'];
        if (!in_array($status,$valid,true)) { \App\Response::json(['message'=>'Select a valid call status.'],422);return true; }
        $outcome=(string)($body['outcome']??'');
        if (!in_array($outcome,['','Interested','Not Interested','Follow-up','Converted'],true)) $outcome='';
        $next=(string)($body['next_followup_date']??'');
        $q=$pdo->prepare("UPDATE calling_entries SET status=?,outcome=?,remarks=?,next_followup_date=?,completed_at=NOW() WHERE id=? AND organization_id=? AND status='Pending'");
        $q->execute([$status,$outcome,(string)($body['remarks']??''),$next!==''?$next:null,(int)$m[1],$org]);
        if (!$q->rowCount()) { \App\Response::json(['message'=>'Call not found or already completed.'],409);return true; }
        \App\Response::json(['status'=>'ok']);return true;
    }
    if ($route === 'entries' && $method === 'GET') {
        $q=$pdo->prepare('SELECT c.*,u.full_name AS employee_name FROM calling_entries c LEFT JOIN users u ON u.id=c.assigned_user_id AND u.organization_id=c.organization_id WHERE c.organization_id=? ORDER BY c.scheduled_date DESC,c.id DESC LIMIT 10000');
        $q->execute([$org]); \App\Response::json(['data'=>$q->fetchAll(PDO::FETCH_ASSOC)]);return true;
    }
    \App\Response::json(['message'=>'Unknown calling endpoint.'],404);return true;
}
