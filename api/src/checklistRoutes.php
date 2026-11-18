<?php
declare(strict_types=1);

/* Isolated checklist tables. Existing operational records are never changed. */
function handleChecklistRoutes(string $path, string $method): bool {
    if (!str_starts_with($path, '/api/checklists/')) return false;
    $pdo = \App\Database::connection();
    $org = requireOrganizationId();
    $pdo->exec("CREATE TABLE IF NOT EXISTS employee_checklists (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, organization_id BIGINT NOT NULL,
      title VARCHAR(200) NOT NULL, active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS employee_checklist_tasks (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, organization_id BIGINT NOT NULL,
      checklist_id BIGINT UNSIGNED NOT NULL, title VARCHAR(255) NOT NULL,
      assigned_user_id BIGINT NOT NULL, frequency VARCHAR(16) NOT NULL,
      start_date DATE NOT NULL, weekday_num TINYINT NULL, month_day TINYINT NULL,
      exclude_sundays TINYINT NOT NULL DEFAULT 0, active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_org_user (organization_id, assigned_user_id),
      INDEX idx_checklist (organization_id, checklist_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // Add scheduling fields without changing existing task records.
    $columns=$pdo->query("SHOW COLUMNS FROM employee_checklist_tasks")->fetchAll(PDO::FETCH_COLUMN);
    foreach (['quarter_offset'=>'SMALLINT UNSIGNED NULL','annual_month'=>'TINYINT UNSIGNED NULL','sunday_action'=>"VARCHAR(12) NOT NULL DEFAULT 'skip'",'deleted_at'=>'DATETIME NULL'] as $col=>$definition) {
      if (!in_array($col,$columns,true)) $pdo->exec("ALTER TABLE employee_checklist_tasks ADD COLUMN ".$col." ".$definition);
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS employee_checklist_completions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, organization_id BIGINT NOT NULL,
      task_id BIGINT UNSIGNED NOT NULL, due_date DATE NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_completion (organization_id,task_id,due_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $route = substr($path,strlen('/api/checklists/'));
    $body = json_decode(file_get_contents('php://input'),true) ?: [];
    $json = static function($data): void { \App\Response::json(['data'=>$data]); };
    if ($route === 'users' && $method === 'GET') {
      $q=$pdo->prepare('SELECT id,full_name FROM users WHERE organization_id=? ORDER BY full_name');
      $q->execute([$org]);$json($q->fetchAll(PDO::FETCH_ASSOC));return true;
    }
    if ($route === 'lists') {
      if ($method === 'POST') {
        $title=trim((string)($body['title']??''));
        if ($title==='') {\App\Response::json(['message'=>'Checklist name is required'],422);return true;}
        $q=$pdo->prepare('INSERT INTO employee_checklists (organization_id,title) VALUES (?,?)');
        $q->execute([$org,$title]);
      }
      if ($method === 'PUT') {
        $q=$pdo->prepare('UPDATE employee_checklists SET title=?,active=? WHERE organization_id=? AND id=?');
        $q->execute([trim((string)($body['title']??'')),empty($body['active'])?0:1,$org,(int)($body['id']??0)]);
      }
      $q=$pdo->prepare('SELECT * FROM employee_checklists WHERE organization_id=? ORDER BY active DESC,id DESC');
      $q->execute([$org]);$json($q->fetchAll(PDO::FETCH_ASSOC));return true;
    }
    if ($route === 'tasks' && $method !== 'DELETE') {
      if ($method === 'POST') {
        $title=trim((string)($body['title']??''));
        $freq=(string)($body['frequency']??'daily');
        $start=(string)($body['start_date']??'');
        if ($title==='' || !in_array($freq,['daily','weekly','monthly','quarterly','annually'],true)
          || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$start) || !strtotime($start)
          || (int)($body['assigned_user_id']??0)<1) {
          \App\Response::json(['message'=>'Valid task name, user, frequency and start date are required'],422);return true;
        }
        $q=$pdo->prepare('SELECT COUNT(*) FROM employee_checklists WHERE id=? AND organization_id=? AND active=1');
        $q->execute([(int)($body['checklist_id']??0),$org]);
        if (!(int)$q->fetchColumn()) {\App\Response::json(['message'=>'Checklist not found'],422);return true;}
        $q=$pdo->prepare('SELECT COUNT(*) FROM users WHERE id=? AND organization_id=?');
        $q->execute([(int)$body['assigned_user_id'],$org]);
        if (!(int)$q->fetchColumn()) {\App\Response::json(['message'=>'Employee not found'],422);return true;}
        $date=new DateTimeImmutable($start);
        $weekday=(int)($body['weekday_num']??$date->format('N'));
        $monthDay=(int)($body['month_day']??$date->format('j'));
        $annualMonth=(int)($body['annual_month']??$date->format('n'));
        $offset=(int)($body['quarter_offset']??0);
        $sundayAction=(string)($body['sunday_action']??'skip');
        if (($freq==='weekly'&&($weekday<1||$weekday>7)) ||
            (in_array($freq,['monthly','annually'],true)&&($monthDay<1||$monthDay>31)) ||
            ($freq==='annually'&&($annualMonth<1||$annualMonth>12||($annualMonth===2&&$monthDay>29)||in_array($annualMonth,[4,6,9,11],true)&&$monthDay>30)) ||
            ($freq==='quarterly'&&($offset<0||$offset>365)) ||
            !in_array($sundayAction,['skip','monday'],true)) {
          \App\Response::json(['message'=>'Invalid recurrence scheduling details'],422);return true;
        }
        $q=$pdo->prepare('INSERT INTO employee_checklist_tasks (organization_id,checklist_id,title,assigned_user_id,frequency,start_date,weekday_num,month_day,exclude_sundays,quarter_offset,annual_month,sunday_action) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $q->execute([$org,(int)$body['checklist_id'],$title,(int)$body['assigned_user_id'],$freq,$start,$weekday,$monthDay,!empty($body['exclude_sundays'])?1:0,$offset,$annualMonth,$sundayAction]);
      }
      if ($method === 'PUT' && !empty($body['edit_details'])) {
        $id=(int)($body['id']??0);
        $title=trim((string)($body['title']??''));
        $freq=(string)($body['frequency']??'');
        $start=(string)($body['start_date']??'');
        $list=(int)($body['checklist_id']??0);
        $user=(int)($body['assigned_user_id']??0);
        $weekday=(int)($body['weekday_num']??0);
        $monthDay=(int)($body['month_day']??0);
        $offset=(int)($body['quarter_offset']??0);
        $annualMonth=(int)($body['annual_month']??0);
        $sundayAction=(string)($body['sunday_action']??'skip');
        if ($id<1 || $title==='' || !in_array($freq,['daily','weekly','monthly','quarterly','annually'],true)
          || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$start) || !checkdate((int)substr($start,5,2),(int)substr($start,8,2),(int)substr($start,0,4))
          || $list<1 || $user<1 || ($freq==='weekly'&&($weekday<1||$weekday>7))
          || (in_array($freq,['monthly','annually'],true)&&($monthDay<1||$monthDay>31))
          || ($freq==='annually'&&($annualMonth<1||$annualMonth>12||($annualMonth===2&&$monthDay>29)||(in_array($annualMonth,[4,6,9,11],true)&&$monthDay>30)))
          || ($freq==='quarterly'&&($offset<0||$offset>365)) || !in_array($sundayAction,['skip','monday'],true)) {
          \App\Response::json(['message'=>'Invalid checklist task details'],422);return true;
        }
        $q=$pdo->prepare('SELECT COUNT(*) FROM employee_checklist_tasks WHERE id=? AND organization_id=?');
        $q->execute([$id,$org]);if (!(int)$q->fetchColumn()) {\App\Response::json(['message'=>'Task not found'],404);return true;}
        $q=$pdo->prepare('SELECT COUNT(*) FROM employee_checklists WHERE id=? AND organization_id=? AND active=1');
        $q->execute([$list,$org]);if (!(int)$q->fetchColumn()) {\App\Response::json(['message'=>'Checklist not found'],422);return true;}
        $q=$pdo->prepare('SELECT COUNT(*) FROM users WHERE id=? AND organization_id=?');
        $q->execute([$user,$org]);if (!(int)$q->fetchColumn()) {\App\Response::json(['message'=>'Employee not found'],422);return true;}
        $q=$pdo->prepare('UPDATE employee_checklist_tasks SET checklist_id=?,title=?,assigned_user_id=?,frequency=?,start_date=?,weekday_num=?,month_day=?,exclude_sundays=?,quarter_offset=?,annual_month=?,sunday_action=? WHERE id=? AND organization_id=?');
        $q->execute([$list,$title,$user,$freq,$start,$weekday,$monthDay,!empty($body['exclude_sundays'])?1:0,$offset,$annualMonth,$sundayAction,$id,$org]);
        $json(['updated'=>true]);return true;
      }
      if ($method === 'PUT') {
        $q=$pdo->prepare('UPDATE employee_checklist_tasks SET active=? WHERE id=? AND organization_id=?');
        $q->execute([!empty($body['active'])?1:0,(int)($body['id']??0),$org]);
      }
      $q=$pdo->prepare('SELECT t.*,c.title AS checklist_name,u.full_name AS employee_name,c.active AS checklist_active FROM employee_checklist_tasks t JOIN employee_checklists c ON c.id=t.checklist_id AND c.organization_id=t.organization_id LEFT JOIN users u ON u.id=t.assigned_user_id AND u.organization_id=t.organization_id WHERE t.organization_id=? AND t.deleted_at IS NULL ORDER BY t.id DESC');
      $q->execute([$org]);$json($q->fetchAll(PDO::FETCH_ASSOC));return true;
    }
    if ($route === 'tasks' && $method === 'DELETE') {
      $id=(int)($body['id']??0);
      $mode=(string)($body['mode']??'task_only');
      if ($id<1 || !in_array($mode,['task_only','with_history'],true)) {
        \App\Response::json(['message'=>'Valid task ID and deletion option are required'],422);return true;
      }
      $q=$pdo->prepare('SELECT id FROM employee_checklist_tasks WHERE id=? AND organization_id=? AND deleted_at IS NULL');
      $q->execute([$id,$org]);
      if (!$q->fetchColumn()) { \App\Response::json(['message'=>'Task not found'],404);return true; }
      if ($mode==='task_only') {
        // Stop future occurrences while retaining existing completion history and task details.
        $q=$pdo->prepare('UPDATE employee_checklist_tasks SET active=0,deleted_at=NOW() WHERE id=? AND organization_id=?');
        $q->execute([$id,$org]);
      } else {
        $pdo->beginTransaction();
        try {
          $q=$pdo->prepare('DELETE FROM employee_checklist_completions WHERE task_id=? AND organization_id=?');
          $q->execute([$id,$org]);
          $q=$pdo->prepare('DELETE FROM employee_checklist_tasks WHERE id=? AND organization_id=?');
          $q->execute([$id,$org]);
          $pdo->commit();
        } catch (Throwable $e) { $pdo->rollBack();throw $e; }
      }
      $json(['deleted'=>true,'mode'=>$mode]);return true;
    }
    if ($route === 'complete' && $method === 'POST') {
      $id=(int)($body['task_id']??0);$due=(string)($body['due_date']??'');
      $q=$pdo->prepare('SELECT * FROM employee_checklist_tasks WHERE id=? AND organization_id=? AND active=1');
      $q->execute([$id,$org]);$task=$q->fetch(PDO::FETCH_ASSOC);
      if (!$task || !checklistOccurs($task,$due) || $due>date('Y-m-d')) {
        \App\Response::json(['message'=>'Task occurrence is not eligible for completion'],422);return true;
      }
      $q=$pdo->prepare('INSERT IGNORE INTO employee_checklist_completions (organization_id,task_id,due_date) VALUES (?,?,?)');
      $q->execute([$org,$id,$due]);$json(['saved'=>true]);return true;
    }
    if ($route === 'occurrences' && $method === 'GET') {
      $from=(string)($_GET['from']??date('Y-m-01'));
      $to=(string)($_GET['to']??date('Y-m-d'));
      if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$from) || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$to)
        || !strtotime($from) || !strtotime($to) || $to<$from || (strtotime($to)-strtotime($from))>366*86400) {
        \App\Response::json(['message'=>'Select a valid date range of at most 366 days'],422);return true;
      }
      $q=$pdo->prepare('SELECT t.*,c.title AS checklist_name,u.full_name AS employee_name FROM employee_checklist_tasks t JOIN employee_checklists c ON c.id=t.checklist_id AND c.organization_id=t.organization_id LEFT JOIN users u ON u.id=t.assigned_user_id AND u.organization_id=t.organization_id WHERE t.organization_id=? AND t.active=1 AND c.active=1 AND t.start_date<=?');
      $q->execute([$org,$to]);$tasks=$q->fetchAll(PDO::FETCH_ASSOC);
      $q=$pdo->prepare('SELECT task_id,due_date,completed_at FROM employee_checklist_completions WHERE organization_id=? AND due_date BETWEEN ? AND ?');
      $q->execute([$org,$from,$to]);$done=[];
      foreach($q->fetchAll(PDO::FETCH_ASSOC) as $c){$done[$c['task_id'].'|'.$c['due_date']]=$c['completed_at'];}
      $items=[];$end=new DateTimeImmutable($to);
      for($d=new DateTimeImmutable($from);$d<=$end;$d=$d->modify('+1 day')){
        $day=$d->format('Y-m-d');
        foreach($tasks as $t){
          if (!checklistOccurs($t,$day)) continue;
          $completed=$done[$t['id'].'|'.$day]??null;
          $items[]=['task_id'=>(int)$t['id'],'title'=>$t['title'],'checklist_name'=>$t['checklist_name'],
            'assigned_user_id'=>(int)$t['assigned_user_id'],'employee_name'=>$t['employee_name'],
            'frequency'=>$t['frequency'],'due_date'=>$day,'completed_at'=>$completed,
            'status'=>$completed?'Completed':($day<date('Y-m-d')?'Overdue':'Pending')];
        }
      }
      $json($items);return true;
    }
    return false;
}
function checklistOccurs(array $t,string $day): bool {
  try {$d=new DateTimeImmutable($day);$start=new DateTimeImmutable($t['start_date']);}
  catch(Throwable $e){return false;}
  if ($d<$start || $d->format('Y-m-d')!==$day) return false;
  $freq=$t['frequency'];
  $weekday=(int)$d->format('N');
  $exclude=!empty($t['exclude_sundays']);
  $action=$t['sunday_action']??'skip';
  // Evaluate the scheduled day and, if requested, the preceding Sunday moved to Monday.
  $candidates=[$d];
  if ($exclude && $action==='monday' && $weekday===1) $candidates[]=$d->modify('-1 day');
  foreach($candidates as $scheduled){
    if ($scheduled<$start) continue;
    if ($exclude && (int)$scheduled->format('N')===7 && $scheduled===$d) continue;
    $year=(int)$scheduled->format('Y');$month=(int)$scheduled->format('n');
    $dayNum=(int)$scheduled->format('j');
    $monthLast=(int)$scheduled->format('t');
    $months=($year-(int)$start->format('Y'))*12+$month-(int)$start->format('n');
    $match=match($freq){
      'daily'=>true,
      'weekly'=>(int)$scheduled->format('N')===(int)$t['weekday_num'],
      'monthly'=>$dayNum===min((int)$t['month_day'],$monthLast),
      'quarterly'=>checklistQuarterDue($scheduled,$t),
      'annually'=>$month===(int)($t['annual_month']??$start->format('n')) &&
        $dayNum===min((int)$t['month_day'],$monthLast),
      default=>false
    };
    if ($match) return true;
  }
  return false;
}
function checklistQuarterDue(DateTimeImmutable $day,array $task): bool {
  if ($task['quarter_offset']===null) {
    // Preserve the original quarterly schedule for previously created tasks.
    $start=new DateTimeImmutable($task['start_date']);
    $months=((int)$day->format('Y')-(int)$start->format('Y'))*12+(int)$day->format('n')-(int)$start->format('n');
    return $months%3===0 && (int)$day->format('j')===(int)$task['month_day'];
  }
  $offset=(int)$task['quarter_offset'];
  $candidate=$day->modify('-'.$offset.' days');
  $month=(int)$candidate->format('n');
  return in_array($month,[3,6,9,12],true) &&
    $candidate->format('j')===$candidate->format('t');
}
