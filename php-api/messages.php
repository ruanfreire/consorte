<?php
/**
 * API simples: GET lista mensagens | POST cria mensagem (JSON).
 * Requer PHP 8.0+ (extensões: pdo_mysql, json).
 */
declare(strict_types=1);

const MAX_TEXT_LEN = 300;
const MAX_IMAGE_BASE64_LEN = 200_000;
const LIST_LIMIT = 80;
const MAX_JSON_BYTES = 2_200_000;

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!is_readable($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_misconfigured'], JSON_UNESCAPED_UNICODE);
    exit;
}

/** @var array{db: array<string, mixed>, cors_origin?: string, cors_origins?: string[]} $cfg */
$cfg = require $configPath;
$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
$origin = '';

if (!empty($cfg['cors_origins']) && is_array($cfg['cors_origins'])) {
    if ($requestOrigin !== '' && in_array($requestOrigin, $cfg['cors_origins'], true)) {
        $origin = $requestOrigin;
    } elseif ($requestOrigin === '' && isset($cfg['cors_origins'][0])) {
        $origin = (string) $cfg['cors_origins'][0];
    } else {
        $origin = '';
    }
} elseif (isset($cfg['cors_origin']) && is_string($cfg['cors_origin'])) {
    $co = $cfg['cors_origin'];
    if ($co === '*') {
        $origin = '*';
    } elseif ($requestOrigin !== '' && $requestOrigin === $co) {
        $origin = $requestOrigin;
    } elseif ($requestOrigin === '' && $co !== '') {
        $origin = $co;
    } elseif ($co !== '') {
        $origin = $co;
    }
} else {
    $origin = '*';
}

if ($origin === '') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'cors_forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$db = $cfg['db'] ?? [];
$dsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=%s',
    $db['host'] ?? '127.0.0.1',
    (int) ($db['port'] ?? 3306),
    $db['name'] ?? '',
    $db['charset'] ?? 'utf8mb4',
);

try {
    $pdo = new PDO(
        $dsn,
        (string) ($db['user'] ?? ''),
        (string) ($db['pass'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ],
    );
} catch (PDOException $e) {
    error_log('[consorte-api] db_connect_failed');
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'db_unavailable'], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    try {
        $stmt = $pdo->prepare(
            'SELECT id, text, image_base64, created_at FROM ana_messages
             ORDER BY created_at DESC LIMIT :lim',
        );
        $stmt->bindValue(':lim', LIST_LIMIT, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log('[consorte-api] list_failed');
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'list_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $messages = [];
    foreach ($rows as $r) {
        $messages[] = [
            'id' => (string) $r['id'],
            'text' => (string) $r['text'],
            'image_base64' => (string) $r['image_base64'],
            'created_at' => (int) $r['created_at'],
        ];
    }

    echo json_encode(['ok' => true, 'messages' => $messages], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > MAX_JSON_BYTES) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'error' => 'payload_too_large'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $data = json_decode($raw, true, 3, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $text = isset($data['text']) ? trim((string) $data['text']) : '';
    $imageBase64 = isset($data['image_base64']) ? (string) $data['image_base64'] : '';

    $textLen = function_exists('mb_strlen')
        ? mb_strlen($text, 'UTF-8')
        : strlen($text);
    if ($text === '' || $textLen > MAX_TEXT_LEN) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_text'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($imageBase64 === '' || strlen($imageBase64) > MAX_IMAGE_BASE64_LEN) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_image'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $id = bin2hex(random_bytes(16));
    $createdAt = (int) round(microtime(true) * 1000);

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO ana_messages (id, text, image_base64, created_at)
             VALUES (:id, :text, :img, :created)',
        );
        $stmt->execute([
            ':id' => $id,
            ':text' => $text,
            ':img' => $imageBase64,
            ':created' => $createdAt,
        ]);
    } catch (PDOException $e) {
        error_log('[consorte-api] insert_failed');
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'save_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => [
            'id' => $id,
            'text' => $text,
            'image_base64' => $imageBase64,
            'created_at' => $createdAt,
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
