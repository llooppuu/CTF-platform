<?php
declare(strict_types=1);

const CTF_DB_PATH = __DIR__ . '/../data/db.json';
const LEGACY_SCRYPT_N = 16384;
const LEGACY_SCRYPT_R = 8;
const LEGACY_SCRYPT_P = 1;
const LEGACY_SCRYPT_DKLEN = 64;
const PASSWORD_HASH_PREFIX = 'pbkdf2_sha256';
const PASSWORD_HASH_ITERATIONS = 210000;

function now_iso(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function random_uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function default_db(): array
{
    return [
        'settings' => [],
        'users' => [],
        'sessions' => [],
        'challenges' => [],
        'solves' => [],
        'hintUnlocks' => [],
        'submissions' => [],
        'announcements' => [],
        'teams' => [],
    ];
}

function read_db(): array
{
    if (!is_file(CTF_DB_PATH)) {
        return default_db();
    }

    $raw = file_get_contents(CTF_DB_PATH);
    if ($raw === false || trim($raw) === '') {
        return default_db();
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : default_db();
}

function write_db(array $data): void
{
    $directory = dirname(CTF_DB_PATH);
    if (!is_dir($directory)) {
        mkdir($directory, 0775, true);
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Failed to encode database.');
    }

    $tempFile = $directory . '/db.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($tempFile, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Failed to write database.');
    }

    if (!rename($tempFile, CTF_DB_PATH)) {
        @unlink($tempFile);
        throw new RuntimeException('Failed to replace database.');
    }
}

function ensure_defaults(array &$db): bool
{
    $changed = false;
    $db += default_db();

    if (!isset($db['settings']) || !is_array($db['settings'])) {
        $db['settings'] = [];
        $changed = true;
    }

    $defaults = [
        'siteTitle' => 'Eesti Attack Map CTF',
        'registrationOpen' => true,
        'challengeVisibility' => 'private',
        'accountVisibility' => 'public',
        'scoreVisibility' => 'public',
        'paused' => false,
        'registrationCode' => '',
        'logoUrl' => '',
        'theme' => 'default',
        'localization' => 'en',
        'customFields' => [],
        'scoreboardBrackets' => [],
        'sanitizeHtml' => true,
        'announcement' => '',
        'startTime' => null,
        'endTime' => null,
    ];

    foreach ($defaults as $key => $value) {
        if (!array_key_exists($key, $db['settings'])) {
            $db['settings'][$key] = $value;
            $changed = true;
        }
    }

    if (!isset($db['settings']['registrationVisibility']) || !is_string($db['settings']['registrationVisibility'])) {
        $db['settings']['registrationVisibility'] = !empty($db['settings']['registrationOpen']) ? 'public' : 'disabled';
        $changed = true;
    }

    foreach (['announcements', 'teams', 'users', 'sessions', 'challenges', 'solves', 'hintUnlocks', 'submissions'] as $key) {
        if (!isset($db[$key]) || !is_array($db[$key])) {
            $db[$key] = [];
            $changed = true;
        }
    }

    return $changed;
}

function hash_password(string $password): string
{
    $salt = bin2hex(random_bytes(16));
    $hash = hash_pbkdf2('sha256', $password, $salt, PASSWORD_HASH_ITERATIONS, LEGACY_SCRYPT_DKLEN, false);
    return PASSWORD_HASH_PREFIX . '$' . PASSWORD_HASH_ITERATIONS . '$' . $salt . '$' . $hash;
}

function is_legacy_scrypt_hash(string $storedValue): bool
{
    return str_contains($storedValue, ':') && !str_contains($storedValue, '$');
}

function verify_password(string $password, string $storedValue): bool
{
    if (str_starts_with($storedValue, PASSWORD_HASH_PREFIX . '$')) {
        $parts = explode('$', $storedValue, 4);
        if (count($parts) !== 4) {
            return false;
        }

        [, $iterations, $salt, $hash] = $parts;
        $expected = hash_pbkdf2('sha256', $password, $salt, (int) $iterations, strlen($hash) / 2, false);
        return hash_equals($hash, $expected);
    }

    if (str_starts_with($storedValue, '$2y$') || str_starts_with($storedValue, '$argon2')) {
        return password_verify($password, $storedValue);
    }

    if (!is_legacy_scrypt_hash($storedValue)) {
        return false;
    }

    [$salt, $hash] = explode(':', $storedValue, 2);
    if ($salt === '' || $hash === '') {
        return false;
    }

    $derived = legacy_scrypt_hex($password, $salt);
    return hash_equals(strtolower($hash), strtolower($derived));
}

function ensure_admin(array &$db): bool
{
    foreach ($db['users'] as $user) {
        if (($user['username'] ?? null) === 'admin') {
            return false;
        }
    }

    $db['users'][] = [
        'id' => random_uuid_v4(),
        'username' => 'admin',
        'displayName' => 'Administrator',
        'email' => 'admin@example.com',
        'bio' => 'Seed admin account',
        'passwordHash' => hash_password('Admin123!'),
        'isAdmin' => true,
        'createdAt' => now_iso(),
    ];

    return true;
}

function bootstrap_db(): array
{
    $db = read_db();
    $changed = ensure_defaults($db);
    $changed = ensure_admin($db) || $changed;

    if ($changed) {
        write_db($db);
    }

    return $db;
}

function sanitize_user(?array $user): ?array
{
    if ($user === null) {
        return null;
    }

    unset($user['passwordHash']);
    return $user;
}

function current_session_token(): ?string
{
    return isset($_COOKIE['session']) && $_COOKIE['session'] !== '' ? (string) $_COOKIE['session'] : null;
}

function set_session_cookie(string $token, int $maxAge): void
{
    setcookie('session', $token, [
        'expires' => time() + $maxAge,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(): void
{
    setcookie('session', '', [
        'expires' => 1,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function send_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function send_empty(int $statusCode): void
{
    http_response_code($statusCode);
    exit;
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function request_path(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/api';
    $path = parse_url($uri, PHP_URL_PATH);
    return is_string($path) ? $path : '/api';
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (($raw === false || $raw === '') && PHP_SAPI === 'cli') {
        $raw = stream_get_contents(STDIN);
    }

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function handle_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigin = getenv('CORS_ORIGIN') ?: '';

    if ($allowedOrigin !== '' && $origin === $allowedOrigin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS');
    }

    if (request_method() === 'OPTIONS') {
        send_empty(204);
    }
}

function get_current_api_user(array $db): ?array
{
    $token = current_session_token();
    if ($token === null) {
        return null;
    }

    $session = find_first($db['sessions'], static fn(array $entry): bool => ($entry['token'] ?? null) === $token);
    if ($session === null) {
        return null;
    }

    return find_first($db['users'], static fn(array $user): bool => ($user['id'] ?? null) === ($session['userId'] ?? null));
}

function require_auth(array $db): array
{
    $user = get_current_api_user($db);
    if ($user === null) {
        send_json(401, ['message' => 'Login required']);
    }

    return $user;
}

function require_admin(array $db): array
{
    $user = require_auth($db);
    if (empty($user['isAdmin'])) {
        send_json(403, ['message' => 'Admin only']);
    }

    return $user;
}

function find_first(array $items, callable $predicate): ?array
{
    foreach ($items as $item) {
        if ($predicate($item)) {
            return $item;
        }
    }

    return null;
}

function find_index(array $items, callable $predicate): ?int
{
    foreach ($items as $index => $item) {
        if ($predicate($item)) {
            return $index;
        }
    }

    return null;
}

function sum_values(array $items, callable $mapper): int
{
    $sum = 0;
    foreach ($items as $item) {
        $sum += (int) $mapper($item);
    }
    return $sum;
}

function get_user_score(array $db, string $userId): int
{
    $solvePoints = sum_values(
        array_filter($db['solves'], static fn(array $solve): bool => ($solve['userId'] ?? null) === $userId),
        static fn(array $solve): int => (int) ($solve['points'] ?? 0)
    );

    $hintPenalty = sum_values(
        array_filter($db['hintUnlocks'], static fn(array $hint): bool => ($hint['userId'] ?? null) === $userId),
        static fn(array $hint): int => (int) ($hint['cost'] ?? 0)
    );

    return $solvePoints - $hintPenalty;
}

function list_challenges_for_user(array $db, ?array $user): array
{
    $result = [];

    foreach ($db['challenges'] as $challenge) {
        if (($challenge['visible'] ?? true) === false) {
            continue;
        }

        $challengeId = (string) ($challenge['id'] ?? '');
        $userId = $user['id'] ?? null;
        $solved = find_first(
            $db['solves'],
            static fn(array $solve): bool => ($solve['userId'] ?? null) === $userId && ($solve['challengeId'] ?? null) === $challengeId
        ) !== null;

        $hintPenalty = sum_values(
            array_filter(
                $db['hintUnlocks'],
                static fn(array $hint): bool => ($hint['userId'] ?? null) === $userId && ($hint['challengeId'] ?? null) === $challengeId
            ),
            static fn(array $hint): int => (int) ($hint['cost'] ?? 0)
        );

        $result[] = [
            'id' => $challenge['id'],
            'slug' => $challenge['slug'],
            'title' => $challenge['title'],
            'category' => $challenge['category'],
            'difficulty' => $challenge['difficulty'],
            'points' => $challenge['points'],
            'lat' => $challenge['lat'],
            'lng' => $challenge['lng'],
            'tags' => array_values($challenge['tags'] ?? []),
            'solved' => $solved,
            'hintPenalty' => $hintPenalty,
            'visible' => ($challenge['visible'] ?? true) !== false,
        ];
    }

    usort($result, static function (array $a, array $b): int {
        return strcmp((string) $a['category'], (string) $b['category'])
            ?: ((int) $a['points'] <=> (int) $b['points'])
            ?: strcmp((string) $a['title'], (string) $b['title']);
    });

    return $result;
}

function get_challenge_detail(array $db, ?array $user, string $challengeId): ?array
{
    $challenge = find_first(
        $db['challenges'],
        static fn(array $item): bool => ($item['id'] ?? null) === $challengeId && (($item['visible'] ?? true) !== false)
    );

    if ($challenge === null) {
        return null;
    }

    $userId = $user['id'] ?? null;
    $solved = find_first(
        $db['solves'],
        static fn(array $solve): bool => ($solve['userId'] ?? null) === $userId && ($solve['challengeId'] ?? null) === $challengeId
    ) !== null;

    $unlockedHintIds = [];
    foreach ($db['hintUnlocks'] as $entry) {
        if (($entry['userId'] ?? null) === $userId && ($entry['challengeId'] ?? null) === $challengeId) {
            $unlockedHintIds[(string) ($entry['hintId'] ?? '')] = true;
        }
    }

    $hints = [];
    foreach ($challenge['hints'] ?? [] as $hint) {
        $unlocked = !empty($unlockedHintIds[(string) ($hint['id'] ?? '')]);
        $hints[] = [
            'id' => $hint['id'],
            'title' => $hint['title'],
            'cost' => $hint['cost'],
            'unlocked' => $unlocked,
            'content' => $unlocked ? ($hint['content'] ?? null) : null,
            'contentHtml' => $unlocked ? ($hint['content'] ?? null) : null,
        ];
    }

    return [
        'id' => $challenge['id'],
        'slug' => $challenge['slug'],
        'title' => $challenge['title'],
        'category' => $challenge['category'],
        'difficulty' => $challenge['difficulty'],
        'points' => $challenge['points'],
        'description' => $challenge['description'],
        'descriptionHtml' => $challenge['description'],
        'lat' => $challenge['lat'],
        'lng' => $challenge['lng'],
        'tags' => array_values($challenge['tags'] ?? []),
        'files' => array_values($challenge['files'] ?? []),
        'solved' => $solved,
        'hints' => $hints,
    ];
}

function get_admin_challenge(array $db, string $challengeId): ?array
{
    return find_first($db['challenges'], static fn(array $challenge): bool => ($challenge['id'] ?? null) === $challengeId);
}

function can_view_by_scope(string $scope, ?array $user): bool
{
    return match ($scope) {
        'public' => true,
        'users' => $user !== null,
        'admins', 'hidden' => !empty($user['isAdmin']),
        default => true,
    };
}

function get_team_score(array $db, string $teamId): int
{
    $score = 0;
    foreach ($db['users'] as $user) {
        if (($user['teamId'] ?? null) === $teamId && empty($user['isAdmin'])) {
            $score += get_user_score($db, (string) $user['id']);
        }
    }
    return $score;
}

function get_challenge_admin_stats(array $db, string $challengeId): array
{
    $solves = array_values(array_filter(
        $db['solves'],
        static fn(array $solve): bool => ($solve['challengeId'] ?? null) === $challengeId
    ));

    $submissions = array_values(array_filter(
        $db['submissions'],
        static fn(array $submission): bool => ($submission['challengeId'] ?? null) === $challengeId
    ));

    $wrongSubmissions = count(array_filter(
        $submissions,
        static fn(array $submission): bool => empty($submission['correct'])
    ));

    usort($solves, static fn(array $a, array $b): int => strcmp((string) ($a['createdAt'] ?? ''), (string) ($b['createdAt'] ?? '')));
    $firstSolve = $solves[0] ?? null;

    return [
        'solveCount' => count($solves),
        'submissionCount' => count($submissions),
        'incorrectSubmissionCount' => $wrongSubmissions,
        'firstBloodAt' => $firstSolve['createdAt'] ?? null,
        'firstBloodUserId' => $firstSolve['userId'] ?? null,
    ];
}

function build_challenge_admin_view(array $db, array $challenge): array
{
    $challenge['stats'] = get_challenge_admin_stats($db, (string) $challenge['id']);
    return $challenge;
}

function sort_desc_by_created_at(array &$items): void
{
    usort($items, static fn(array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
}

function response_user_with_team(array $db, ?array $user): ?array
{
    if ($user === null) {
        return null;
    }

    $team = null;
    if (!empty($user['teamId'])) {
        $matchedTeam = find_first($db['teams'], static fn(array $item): bool => ($item['id'] ?? null) === $user['teamId']);
        if ($matchedTeam !== null) {
            $team = [
                'id' => $matchedTeam['id'],
                'name' => $matchedTeam['name'],
            ];
        }
    }

    $safe = sanitize_user($user) ?? [];
    $safe['score'] = get_user_score($db, (string) $user['id']);
    $safe['team'] = $team;

    return $safe;
}

function legacy_scrypt_hex(string $password, string $salt): string
{
    return bin2hex(legacy_scrypt_raw($password, $salt, LEGACY_SCRYPT_N, LEGACY_SCRYPT_R, LEGACY_SCRYPT_P, LEGACY_SCRYPT_DKLEN));
}

function legacy_scrypt_raw(string $password, string $salt, int $n, int $r, int $p, int $dkLen): string
{
    $blockSize = 128 * $r;
    $b = hash_pbkdf2('sha256', $password, $salt, 1, $p * $blockSize, true);

    $mixed = '';
    for ($i = 0; $i < $p; $i++) {
        $chunk = substr($b, $i * $blockSize, $blockSize);
        $mixed .= romix($chunk, $n, $r);
    }

    return hash_pbkdf2('sha256', $password, $mixed, 1, $dkLen, true);
}

function romix(string $block, int $n, int $r): string
{
    $x = $block;
    $v = [];

    for ($i = 0; $i < $n; $i++) {
        $v[$i] = $x;
        $x = blockmix_salsa8($x, $r);
    }

    for ($i = 0; $i < $n; $i++) {
        $j = integerify($x, $r) & ($n - 1);
        $x = blockmix_salsa8($x ^ $v[$j], $r);
    }

    return $x;
}

function integerify(string $block, int $r): int
{
    $tail = substr($block, (2 * $r - 1) * 64, 4);
    $parts = unpack('V', $tail);
    return (int) ($parts[1] ?? 0);
}

function blockmix_salsa8(string $block, int $r): string
{
    $x = substr($block, (2 * $r - 1) * 64, 64);
    $y = [];

    for ($i = 0; $i < 2 * $r; $i++) {
        $chunk = substr($block, $i * 64, 64);
        $x = salsa20_8($x ^ $chunk);
        $y[$i] = $x;
    }

    $output = '';
    for ($i = 0; $i < 2 * $r; $i += 2) {
        $output .= $y[$i];
    }
    for ($i = 1; $i < 2 * $r; $i += 2) {
        $output .= $y[$i];
    }

    return $output;
}

function salsa20_8(string $block): string
{
    $x = array_values(unpack('V16', $block));
    $orig = $x;

    for ($i = 0; $i < 4; $i++) {
        $x[4] ^= rotl32(($x[0] + $x[12]) & 0xffffffff, 7);
        $x[8] ^= rotl32(($x[4] + $x[0]) & 0xffffffff, 9);
        $x[12] ^= rotl32(($x[8] + $x[4]) & 0xffffffff, 13);
        $x[0] ^= rotl32(($x[12] + $x[8]) & 0xffffffff, 18);

        $x[9] ^= rotl32(($x[5] + $x[1]) & 0xffffffff, 7);
        $x[13] ^= rotl32(($x[9] + $x[5]) & 0xffffffff, 9);
        $x[1] ^= rotl32(($x[13] + $x[9]) & 0xffffffff, 13);
        $x[5] ^= rotl32(($x[1] + $x[13]) & 0xffffffff, 18);

        $x[14] ^= rotl32(($x[10] + $x[6]) & 0xffffffff, 7);
        $x[2] ^= rotl32(($x[14] + $x[10]) & 0xffffffff, 9);
        $x[6] ^= rotl32(($x[2] + $x[14]) & 0xffffffff, 13);
        $x[10] ^= rotl32(($x[6] + $x[2]) & 0xffffffff, 18);

        $x[3] ^= rotl32(($x[15] + $x[11]) & 0xffffffff, 7);
        $x[7] ^= rotl32(($x[3] + $x[15]) & 0xffffffff, 9);
        $x[11] ^= rotl32(($x[7] + $x[3]) & 0xffffffff, 13);
        $x[15] ^= rotl32(($x[11] + $x[7]) & 0xffffffff, 18);

        $x[1] ^= rotl32(($x[0] + $x[3]) & 0xffffffff, 7);
        $x[2] ^= rotl32(($x[1] + $x[0]) & 0xffffffff, 9);
        $x[3] ^= rotl32(($x[2] + $x[1]) & 0xffffffff, 13);
        $x[0] ^= rotl32(($x[3] + $x[2]) & 0xffffffff, 18);

        $x[6] ^= rotl32(($x[5] + $x[4]) & 0xffffffff, 7);
        $x[7] ^= rotl32(($x[6] + $x[5]) & 0xffffffff, 9);
        $x[4] ^= rotl32(($x[7] + $x[6]) & 0xffffffff, 13);
        $x[5] ^= rotl32(($x[4] + $x[7]) & 0xffffffff, 18);

        $x[11] ^= rotl32(($x[10] + $x[9]) & 0xffffffff, 7);
        $x[8] ^= rotl32(($x[11] + $x[10]) & 0xffffffff, 9);
        $x[9] ^= rotl32(($x[8] + $x[11]) & 0xffffffff, 13);
        $x[10] ^= rotl32(($x[9] + $x[8]) & 0xffffffff, 18);

        $x[12] ^= rotl32(($x[15] + $x[14]) & 0xffffffff, 7);
        $x[13] ^= rotl32(($x[12] + $x[15]) & 0xffffffff, 9);
        $x[14] ^= rotl32(($x[13] + $x[12]) & 0xffffffff, 13);
        $x[15] ^= rotl32(($x[14] + $x[13]) & 0xffffffff, 18);
    }

    $out = [];
    foreach ($x as $index => $value) {
        $out[$index] = ($value + $orig[$index]) & 0xffffffff;
    }

    return pack('V16', ...$out);
}

function rotl32(int $value, int $bits): int
{
    $value &= 0xffffffff;
    return (($value << $bits) | (($value & 0xffffffff) >> (32 - $bits))) & 0xffffffff;
}

function handle_request(): void
{
    handle_cors();

    $db = bootstrap_db();
    $method = request_method();
    $path = request_path();
    $user = get_current_api_user($db);

    if ($method === 'GET' && $path === '/api/health') {
        send_json(200, ['ok' => true]);
    }

    if ($method === 'GET' && $path === '/api/settings') {
        $announcements = array_values(array_filter(
            $db['announcements'],
            static fn(array $item): bool => ($item['visible'] ?? true) !== false
        ));
        sort_desc_by_created_at($announcements);
        send_json(200, ['settings' => $db['settings'], 'announcements' => $announcements]);
    }

    if ($method === 'GET' && $path === '/api/auth/me') {
        send_json(200, ['user' => response_user_with_team($db, $user)]);
    }

    if ($method === 'POST' && $path === '/api/auth/register') {
        if (($db['settings']['registrationVisibility'] ?? 'public') === 'disabled' || empty($db['settings']['registrationOpen'])) {
            send_json(403, ['message' => 'Registration is closed']);
        }

        $body = read_json_body();
        if (($db['settings']['registrationCode'] ?? '') !== '') {
            $code = trim((string) ($body['registrationCode'] ?? ''));
            if ($code !== (string) $db['settings']['registrationCode']) {
                send_json(403, ['message' => 'Invalid registration code']);
            }
        }

        $username = strtolower(trim((string) ($body['username'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        if (strlen($username) < 3) {
            send_json(400, ['message' => 'Username must be at least 3 chars']);
        }
        if (strlen($password) < 6) {
            send_json(400, ['message' => 'Password must be at least 6 chars']);
        }

        foreach ($db['users'] as $existingUser) {
            if (($existingUser['username'] ?? null) === $username) {
                send_json(400, ['message' => 'Username already exists']);
            }
        }

        $newUser = [
            'id' => random_uuid_v4(),
            'username' => $username,
            'displayName' => trim((string) ($body['displayName'] ?? $username)) ?: $username,
            'email' => trim((string) ($body['email'] ?? '')),
            'bio' => '',
            'passwordHash' => hash_password($password),
            'isAdmin' => false,
            'createdAt' => now_iso(),
        ];

        $db['users'][] = $newUser;
        $token = bin2hex(random_bytes(32));
        $db['sessions'][] = ['token' => $token, 'userId' => $newUser['id'], 'createdAt' => now_iso()];
        write_db($db);
        set_session_cookie($token, 60 * 60 * 24 * 7);
        send_json(201, ['user' => sanitize_user($newUser)]);
    }

    if ($method === 'POST' && $path === '/api/auth/login') {
        $body = read_json_body();
        $username = strtolower(trim((string) ($body['username'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        $userIndex = find_index($db['users'], static fn(array $entry): bool => ($entry['username'] ?? null) === $username);
        if ($userIndex === null || !verify_password($password, (string) ($db['users'][$userIndex]['passwordHash'] ?? ''))) {
            send_json(401, ['message' => 'Invalid credentials']);
        }

        if (is_legacy_scrypt_hash((string) $db['users'][$userIndex]['passwordHash'])) {
            $db['users'][$userIndex]['passwordHash'] = hash_password($password);
        }

        $token = bin2hex(random_bytes(32));
        $db['sessions'][] = ['token' => $token, 'userId' => $db['users'][$userIndex]['id'], 'createdAt' => now_iso()];
        write_db($db);
        set_session_cookie($token, 60 * 60 * 24 * 7);
        send_json(200, ['user' => sanitize_user($db['users'][$userIndex])]);
    }

    if ($method === 'POST' && $path === '/api/auth/logout') {
        $token = current_session_token();
        if ($token !== null) {
            $db['sessions'] = array_values(array_filter(
                $db['sessions'],
                static fn(array $entry): bool => ($entry['token'] ?? null) !== $token
            ));
            write_db($db);
        }

        clear_session_cookie();
        send_json(200, ['ok' => true]);
    }

    if ($method === 'PATCH' && $path === '/api/profile') {
        $current = require_auth($db);
        $body = read_json_body();
        $userIndex = find_index($db['users'], static fn(array $entry): bool => ($entry['id'] ?? null) === $current['id']);
        if ($userIndex === null) {
            send_json(404, ['message' => 'User not found']);
        }

        $existing = $db['users'][$userIndex];
        $db['users'][$userIndex]['displayName'] = trim((string) ($body['displayName'] ?? $existing['displayName'])) ?: $existing['displayName'];
        $db['users'][$userIndex]['email'] = trim((string) ($body['email'] ?? ($existing['email'] ?? '')));
        $db['users'][$userIndex]['bio'] = trim((string) ($body['bio'] ?? ($existing['bio'] ?? '')));

        if (!empty($body['password'])) {
            $password = (string) $body['password'];
            if (strlen($password) < 6) {
                send_json(400, ['message' => 'Password must be at least 6 chars']);
            }
            $db['users'][$userIndex]['passwordHash'] = hash_password($password);
        }

        write_db($db);
        send_json(200, ['user' => sanitize_user($db['users'][$userIndex])]);
    }

    if ($method === 'GET' && $path === '/api/challenges') {
        if (($db['settings']['challengeVisibility'] ?? 'private') === 'private' && $user === null) {
            send_json(401, ['message' => 'Login required to view challenges']);
        }

        send_json(200, ['challenges' => list_challenges_for_user($db, $user)]);
    }

    if ($method === 'GET' && preg_match('#^/api/challenges/([^/]+)$#', $path, $matches) === 1) {
        if (($db['settings']['challengeVisibility'] ?? 'private') === 'private' && $user === null) {
            send_json(401, ['message' => 'Login required to view challenge']);
        }

        $challenge = get_challenge_detail($db, $user, $matches[1]);
        if ($challenge === null) {
            send_json(404, ['message' => 'Challenge not found']);
        }

        send_json(200, ['challenge' => $challenge]);
    }

    if ($method === 'POST' && preg_match('#^/api/challenges/([^/]+)/submit$#', $path, $matches) === 1) {
        $current = require_auth($db);
        $challenge = get_admin_challenge($db, $matches[1]);
        if ($challenge === null || (($challenge['visible'] ?? true) === false)) {
            send_json(404, ['message' => 'Challenge not found']);
        }
        if (!empty($db['settings']['paused']) && empty($current['isAdmin'])) {
            send_json(403, ['message' => 'CTF is paused']);
        }

        $body = read_json_body();
        $submission = trim((string) ($body['submission'] ?? ''));
        $alreadySolved = find_first(
            $db['solves'],
            static fn(array $solve): bool => ($solve['userId'] ?? null) === $current['id'] && ($solve['challengeId'] ?? null) === $challenge['id']
        );

        $db['submissions'][] = [
            'id' => random_uuid_v4(),
            'userId' => $current['id'],
            'challengeId' => $challenge['id'],
            'submission' => $submission,
            'createdAt' => now_iso(),
            'correct' => $submission === ($challenge['flag'] ?? ''),
        ];

        if ($alreadySolved !== null) {
            write_db($db);
            send_json(200, ['status' => 'already_solved', 'message' => 'See challenge on juba lahendatud.']);
        }

        if ($submission === ($challenge['flag'] ?? '')) {
            $db['solves'][] = [
                'id' => random_uuid_v4(),
                'userId' => $current['id'],
                'challengeId' => $challenge['id'],
                'points' => (int) ($challenge['points'] ?? 0),
                'createdAt' => now_iso(),
            ];
            write_db($db);
            send_json(200, ['status' => 'correct', 'message' => 'Õige flag!']);
        }

        write_db($db);
        send_json(200, ['status' => 'incorrect', 'message' => 'Vale flag.']);
    }

    if ($method === 'POST' && preg_match('#^/api/challenges/([^/]+)/hints/([^/]+)/unlock$#', $path, $matches) === 1) {
        $current = require_auth($db);
        $challenge = get_admin_challenge($db, $matches[1]);
        if ($challenge === null) {
            send_json(404, ['message' => 'Challenge not found']);
        }
        if (!empty($db['settings']['paused']) && empty($current['isAdmin'])) {
            send_json(403, ['message' => 'CTF is paused']);
        }

        $hint = find_first($challenge['hints'] ?? [], static fn(array $entry): bool => ($entry['id'] ?? null) === $matches[2]);
        if ($hint === null) {
            send_json(404, ['message' => 'Hint not found']);
        }

        $exists = find_first(
            $db['hintUnlocks'],
            static fn(array $entry): bool => ($entry['userId'] ?? null) === $current['id']
                && ($entry['challengeId'] ?? null) === $challenge['id']
                && ($entry['hintId'] ?? null) === $hint['id']
        );

        if ($exists !== null) {
            send_json(200, ['ok' => true, 'message' => 'Hint on juba avatud.']);
        }

        $db['hintUnlocks'][] = [
            'id' => random_uuid_v4(),
            'userId' => $current['id'],
            'challengeId' => $challenge['id'],
            'hintId' => $hint['id'],
            'cost' => (int) ($hint['cost'] ?? 0),
            'createdAt' => now_iso(),
        ];
        write_db($db);
        send_json(200, ['ok' => true, 'message' => 'Hint avatud (' . ((int) ($hint['cost'] ?? 0)) . ' punkti).']);
    }

    if ($method === 'GET' && $path === '/api/scoreboard') {
        if (!can_view_by_scope((string) ($db['settings']['accountVisibility'] ?? 'public'), $user)) {
            send_json($user !== null ? 403 : 401, ['message' => 'Account visibility restricted']);
        }
        if (!can_view_by_scope((string) ($db['settings']['scoreVisibility'] ?? 'public'), $user)) {
            send_json($user !== null ? 403 : 401, ['message' => 'Scoreboard visibility restricted']);
        }

        $entries = [];
        foreach ($db['users'] as $entry) {
            if (!empty($entry['isAdmin'])) {
                continue;
            }
            $teamName = null;
            if (!empty($entry['teamId'])) {
                $team = find_first($db['teams'], static fn(array $candidate): bool => ($candidate['id'] ?? null) === $entry['teamId']);
                $teamName = $team['name'] ?? null;
            }
            $entries[] = [
                'userId' => $entry['id'],
                'username' => $entry['username'],
                'displayName' => $entry['displayName'],
                'teamId' => $entry['teamId'] ?? null,
                'teamName' => $teamName,
                'score' => get_user_score($db, (string) $entry['id']),
                'solveCount' => count(array_filter($db['solves'], static fn(array $solve): bool => ($solve['userId'] ?? null) === $entry['id'])),
                'hintPenalty' => sum_values(
                    array_filter($db['hintUnlocks'], static fn(array $hint): bool => ($hint['userId'] ?? null) === $entry['id']),
                    static fn(array $hint): int => (int) ($hint['cost'] ?? 0)
                ),
            ];
        }

        usort($entries, static fn(array $a, array $b): int => ((int) $b['score'] <=> (int) $a['score']) ?: strcmp((string) $a['username'], (string) $b['username']));

        $teamEntries = [];
        foreach ($db['teams'] as $team) {
            $members = array_values(array_filter(
                $db['users'],
                static fn(array $userItem): bool => ($userItem['teamId'] ?? null) === ($team['id'] ?? null) && empty($userItem['isAdmin'])
            ));
            $teamEntries[] = [
                'teamId' => $team['id'],
                'name' => $team['name'],
                'memberCount' => count($members),
                'score' => get_team_score($db, (string) $team['id']),
            ];
        }

        usort($teamEntries, static fn(array $a, array $b): int => ((int) $b['score'] <=> (int) $a['score']) ?: strcmp((string) $a['name'], (string) $b['name']));
        send_json(200, ['entries' => $entries, 'topTen' => array_slice($entries, 0, 10), 'teamEntries' => $teamEntries]);
    }

    if ($method === 'GET' && $path === '/api/teams') {
        if (!can_view_by_scope((string) ($db['settings']['accountVisibility'] ?? 'public'), $user)) {
            send_json($user !== null ? 403 : 401, ['message' => 'Account visibility restricted']);
        }

        $teams = [];
        foreach ($db['teams'] as $team) {
            $teams[] = [
                'id' => $team['id'],
                'name' => $team['name'],
                'bio' => $team['bio'] ?? '',
                'memberCount' => count(array_filter(
                    $db['users'],
                    static fn(array $userItem): bool => ($userItem['teamId'] ?? null) === ($team['id'] ?? null) && empty($userItem['isAdmin'])
                )),
                'score' => get_team_score($db, (string) $team['id']),
            ];
        }

        usort($teams, static fn(array $a, array $b): int => ((int) $b['score'] <=> (int) $a['score']) ?: strcmp((string) $a['name'], (string) $b['name']));
        send_json(200, ['teams' => $teams]);
    }

    if ($method === 'GET' && $path === '/api/admin/challenges') {
        require_admin($db);
        $challenges = array_map(static fn(array $challenge): array => build_challenge_admin_view($db, $challenge), $db['challenges']);
        send_json(200, ['challenges' => $challenges]);
    }

    if ($method === 'POST' && $path === '/api/admin/challenges') {
        require_admin($db);
        $body = read_json_body();
        if (empty($body['title']) || empty($body['slug']) || empty($body['flag'])) {
            send_json(400, ['message' => 'title, slug and flag are required']);
        }

        foreach ($db['challenges'] as $challenge) {
            if (($challenge['slug'] ?? null) === $body['slug']) {
                send_json(400, ['message' => 'Slug already exists']);
            }
        }

        $hints = [];
        foreach (($body['hints'] ?? []) as $hint) {
            $hints[] = array_merge($hint, ['id' => $hint['id'] ?? random_uuid_v4()]);
        }

        $challenge = [
            'id' => random_uuid_v4(),
            'title' => (string) $body['title'],
            'slug' => (string) $body['slug'],
            'category' => (string) ($body['category'] ?? 'misc'),
            'difficulty' => (string) ($body['difficulty'] ?? 'easy'),
            'points' => (int) ($body['points'] ?? 0),
            'description' => (string) ($body['description'] ?? ''),
            'flag' => (string) $body['flag'],
            'lat' => (float) ($body['lat'] ?? 0),
            'lng' => (float) ($body['lng'] ?? 0),
            'tags' => array_values(is_array($body['tags'] ?? null) ? $body['tags'] : []),
            'files' => array_values(is_array($body['files'] ?? null) ? $body['files'] : []),
            'hints' => $hints,
            'positionLocked' => ($body['positionLocked'] ?? false) === true,
            'visible' => ($body['visible'] ?? true) !== false,
            'createdAt' => now_iso(),
        ];

        $db['challenges'][] = $challenge;
        write_db($db);
        send_json(201, ['challenge' => build_challenge_admin_view($db, $challenge)]);
    }

    if (preg_match('#^/api/admin/challenges/([^/]+)$#', $path, $matches) === 1) {
        if ($method === 'PATCH') {
            require_admin($db);
            $challengeIndex = find_index($db['challenges'], static fn(array $challenge): bool => ($challenge['id'] ?? null) === $matches[1]);
            if ($challengeIndex === null) {
                send_json(404, ['message' => 'Challenge not found']);
            }

            $body = read_json_body();
            $existing = $db['challenges'][$challengeIndex];
            $db['challenges'][$challengeIndex] = array_merge($existing, [
                'title' => (string) ($body['title'] ?? $existing['title']),
                'slug' => (string) ($body['slug'] ?? $existing['slug']),
                'category' => (string) ($body['category'] ?? $existing['category']),
                'difficulty' => (string) ($body['difficulty'] ?? $existing['difficulty']),
                'points' => (int) ($body['points'] ?? $existing['points']),
                'description' => (string) ($body['description'] ?? $existing['description']),
                'flag' => (string) ($body['flag'] ?? $existing['flag']),
                'lat' => (float) ($body['lat'] ?? $existing['lat']),
                'lng' => (float) ($body['lng'] ?? $existing['lng']),
                'tags' => is_array($body['tags'] ?? null) ? array_values($body['tags']) : ($existing['tags'] ?? []),
                'files' => is_array($body['files'] ?? null) ? array_values($body['files']) : ($existing['files'] ?? []),
                'hints' => is_array($body['hints'] ?? null)
                    ? array_map(static fn(array $hint): array => array_merge($hint, ['id' => $hint['id'] ?? random_uuid_v4()]), $body['hints'])
                    : ($existing['hints'] ?? []),
                'positionLocked' => array_key_exists('positionLocked', $body) ? (bool) $body['positionLocked'] : (bool) ($existing['positionLocked'] ?? false),
                'visible' => array_key_exists('visible', $body) ? (bool) $body['visible'] : ($existing['visible'] ?? true),
            ]);

            write_db($db);
            send_json(200, ['challenge' => build_challenge_admin_view($db, $db['challenges'][$challengeIndex])]);
        }

        if ($method === 'DELETE') {
            require_admin($db);
            $challengeIndex = find_index($db['challenges'], static fn(array $challenge): bool => ($challenge['id'] ?? null) === $matches[1]);
            if ($challengeIndex === null) {
                send_json(404, ['message' => 'Challenge not found']);
            }

            $challenge = $db['challenges'][$challengeIndex];
            array_splice($db['challenges'], $challengeIndex, 1);
            $db['solves'] = array_values(array_filter($db['solves'], static fn(array $solve): bool => ($solve['challengeId'] ?? null) !== $challenge['id']));
            $db['hintUnlocks'] = array_values(array_filter($db['hintUnlocks'], static fn(array $hint): bool => ($hint['challengeId'] ?? null) !== $challenge['id']));
            $db['submissions'] = array_values(array_filter($db['submissions'], static fn(array $submission): bool => ($submission['challengeId'] ?? null) !== $challenge['id']));
            write_db($db);
            send_json(200, ['ok' => true]);
        }
    }

    if ($method === 'GET' && $path === '/api/admin/announcements') {
        require_admin($db);
        $announcements = array_values($db['announcements']);
        sort_desc_by_created_at($announcements);
        send_json(200, ['announcements' => $announcements]);
    }

    if ($method === 'POST' && $path === '/api/admin/announcements') {
        require_admin($db);
        $body = read_json_body();
        $title = trim((string) ($body['title'] ?? ''));
        $content = trim((string) ($body['content'] ?? ''));
        if ($title === '' || $content === '') {
            send_json(400, ['message' => 'title and content are required']);
        }

        $announcement = [
            'id' => random_uuid_v4(),
            'title' => $title,
            'content' => $content,
            'visible' => ($body['visible'] ?? true) !== false,
            'createdAt' => now_iso(),
            'updatedAt' => now_iso(),
        ];
        $db['announcements'][] = $announcement;
        write_db($db);
        send_json(201, ['announcement' => $announcement]);
    }

    if (preg_match('#^/api/admin/announcements/([^/]+)$#', $path, $matches) === 1) {
        if ($method === 'PATCH') {
            require_admin($db);
            $announcementIndex = find_index($db['announcements'], static fn(array $item): bool => ($item['id'] ?? null) === $matches[1]);
            if ($announcementIndex === null) {
                send_json(404, ['message' => 'Announcement not found']);
            }

            $body = read_json_body();
            $db['announcements'][$announcementIndex]['title'] = trim((string) ($body['title'] ?? $db['announcements'][$announcementIndex]['title']));
            $db['announcements'][$announcementIndex]['content'] = trim((string) ($body['content'] ?? $db['announcements'][$announcementIndex]['content']));
            $db['announcements'][$announcementIndex]['visible'] = array_key_exists('visible', $body)
                ? (bool) $body['visible']
                : ($db['announcements'][$announcementIndex]['visible'] ?? true);
            $db['announcements'][$announcementIndex]['updatedAt'] = now_iso();

            if ($db['announcements'][$announcementIndex]['title'] === '' || $db['announcements'][$announcementIndex]['content'] === '') {
                send_json(400, ['message' => 'title and content are required']);
            }

            write_db($db);
            send_json(200, ['announcement' => $db['announcements'][$announcementIndex]]);
        }

        if ($method === 'DELETE') {
            require_admin($db);
            $announcementIndex = find_index($db['announcements'], static fn(array $item): bool => ($item['id'] ?? null) === $matches[1]);
            if ($announcementIndex === null) {
                send_json(404, ['message' => 'Announcement not found']);
            }

            array_splice($db['announcements'], $announcementIndex, 1);
            write_db($db);
            send_json(200, ['ok' => true]);
        }
    }

    if ($method === 'PATCH' && $path === '/api/admin/settings') {
        require_admin($db);
        $body = read_json_body();

        $db['settings'] = array_merge($db['settings'], [
            'siteTitle' => array_key_exists('siteTitle', $body)
                ? (trim((string) $body['siteTitle']) ?: $db['settings']['siteTitle'])
                : $db['settings']['siteTitle'],
            'registrationOpen' => array_key_exists('registrationOpen', $body) ? (bool) $body['registrationOpen'] : $db['settings']['registrationOpen'],
            'challengeVisibility' => array_key_exists('challengeVisibility', $body) ? (string) $body['challengeVisibility'] : $db['settings']['challengeVisibility'],
            'accountVisibility' => array_key_exists('accountVisibility', $body) ? (string) $body['accountVisibility'] : $db['settings']['accountVisibility'],
            'scoreVisibility' => array_key_exists('scoreVisibility', $body) ? (string) $body['scoreVisibility'] : $db['settings']['scoreVisibility'],
            'registrationVisibility' => array_key_exists('registrationVisibility', $body) ? (string) $body['registrationVisibility'] : $db['settings']['registrationVisibility'],
            'paused' => array_key_exists('paused', $body) ? (bool) $body['paused'] : $db['settings']['paused'],
            'registrationCode' => array_key_exists('registrationCode', $body) ? (string) $body['registrationCode'] : $db['settings']['registrationCode'],
            'logoUrl' => array_key_exists('logoUrl', $body) ? (string) $body['logoUrl'] : $db['settings']['logoUrl'],
            'theme' => array_key_exists('theme', $body) ? (string) $body['theme'] : $db['settings']['theme'],
            'localization' => array_key_exists('localization', $body) ? (string) $body['localization'] : $db['settings']['localization'],
            'customFields' => is_array($body['customFields'] ?? null) ? $body['customFields'] : $db['settings']['customFields'],
            'scoreboardBrackets' => is_array($body['scoreboardBrackets'] ?? null) ? $body['scoreboardBrackets'] : $db['settings']['scoreboardBrackets'],
            'sanitizeHtml' => array_key_exists('sanitizeHtml', $body) ? (bool) $body['sanitizeHtml'] : $db['settings']['sanitizeHtml'],
            'announcement' => array_key_exists('announcement', $body) ? (string) $body['announcement'] : $db['settings']['announcement'],
            'startTime' => array_key_exists('startTime', $body) ? $body['startTime'] : $db['settings']['startTime'],
            'endTime' => array_key_exists('endTime', $body) ? $body['endTime'] : $db['settings']['endTime'],
        ]);

        write_db($db);
        send_json(200, ['settings' => $db['settings']]);
    }

    if ($method === 'GET' && $path === '/api/admin/users') {
        require_admin($db);
        $users = [];
        foreach ($db['users'] as $userItem) {
            if (!empty($userItem['isAdmin'])) {
                continue;
            }
            $users[] = [
                'id' => $userItem['id'],
                'username' => $userItem['username'],
                'displayName' => $userItem['displayName'],
                'teamId' => $userItem['teamId'] ?? null,
                'score' => get_user_score($db, (string) $userItem['id']),
            ];
        }

        usort($users, static fn(array $a, array $b): int => ((int) $b['score'] <=> (int) $a['score']) ?: strcmp((string) $a['username'], (string) $b['username']));
        send_json(200, ['users' => $users]);
    }

    if ($method === 'GET' && $path === '/api/admin/teams') {
        require_admin($db);
        $teams = [];
        foreach ($db['teams'] as $team) {
            $members = [];
            foreach ($db['users'] as $userItem) {
                if (($userItem['teamId'] ?? null) === ($team['id'] ?? null) && empty($userItem['isAdmin'])) {
                    $members[] = [
                        'id' => $userItem['id'],
                        'username' => $userItem['username'],
                        'displayName' => $userItem['displayName'],
                    ];
                }
            }

            $teams[] = array_merge($team, ['members' => $members]);
        }

        usort($teams, static fn(array $a, array $b): int => strcmp((string) $a['name'], (string) $b['name']));
        send_json(200, ['teams' => $teams]);
    }

    if ($method === 'POST' && $path === '/api/admin/teams') {
        require_admin($db);
        $body = read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            send_json(400, ['message' => 'Team name is required']);
        }

        foreach ($db['teams'] as $team) {
            if (strcasecmp((string) ($team['name'] ?? ''), $name) === 0) {
                send_json(400, ['message' => 'Team name already exists']);
            }
        }

        $team = [
            'id' => random_uuid_v4(),
            'name' => $name,
            'bio' => (string) ($body['bio'] ?? ''),
            'createdAt' => now_iso(),
        ];
        $db['teams'][] = $team;

        $memberIds = is_array($body['memberIds'] ?? null) ? $body['memberIds'] : [];
        foreach ($db['users'] as $index => $userItem) {
            if (!empty($userItem['isAdmin'])) {
                continue;
            }
            if (in_array($userItem['id'], $memberIds, true)) {
                $db['users'][$index]['teamId'] = $team['id'];
            }
        }

        write_db($db);
        send_json(201, ['team' => $team]);
    }

    if (preg_match('#^/api/admin/teams/([^/]+)$#', $path, $matches) === 1) {
        if ($method === 'PATCH') {
            require_admin($db);
            $teamIndex = find_index($db['teams'], static fn(array $item): bool => ($item['id'] ?? null) === $matches[1]);
            if ($teamIndex === null) {
                send_json(404, ['message' => 'Team not found']);
            }

            $body = read_json_body();
            $nextName = trim((string) ($body['name'] ?? $db['teams'][$teamIndex]['name']));
            if ($nextName === '') {
                send_json(400, ['message' => 'Team name is required']);
            }

            foreach ($db['teams'] as $index => $team) {
                if ($index !== $teamIndex && strcasecmp((string) ($team['name'] ?? ''), $nextName) === 0) {
                    send_json(400, ['message' => 'Team name already exists']);
                }
            }

            $db['teams'][$teamIndex]['name'] = $nextName;
            $db['teams'][$teamIndex]['bio'] = (string) ($body['bio'] ?? ($db['teams'][$teamIndex]['bio'] ?? ''));

            if (is_array($body['memberIds'] ?? null)) {
                $memberIds = $body['memberIds'];
                foreach ($db['users'] as $index => $userItem) {
                    if (!empty($userItem['isAdmin'])) {
                        continue;
                    }

                    if (in_array($userItem['id'], $memberIds, true)) {
                        $db['users'][$index]['teamId'] = $db['teams'][$teamIndex]['id'];
                    } elseif (($userItem['teamId'] ?? null) === $db['teams'][$teamIndex]['id']) {
                        $db['users'][$index]['teamId'] = null;
                    }
                }
            }

            write_db($db);
            send_json(200, ['team' => $db['teams'][$teamIndex]]);
        }

        if ($method === 'DELETE') {
            require_admin($db);
            $teamIndex = find_index($db['teams'], static fn(array $item): bool => ($item['id'] ?? null) === $matches[1]);
            if ($teamIndex === null) {
                send_json(404, ['message' => 'Team not found']);
            }

            $team = $db['teams'][$teamIndex];
            array_splice($db['teams'], $teamIndex, 1);
            foreach ($db['users'] as $index => $userItem) {
                if (($userItem['teamId'] ?? null) === $team['id']) {
                    $db['users'][$index]['teamId'] = null;
                }
            }

            write_db($db);
            send_json(200, ['ok' => true]);
        }
    }

    if ($method === 'GET' && $path === '/api/admin/export') {
        require_admin($db);
        $exported = $db;
        $exported['sessions'] = [];
        send_json(200, ['data' => $exported]);
    }

    if ($method === 'POST' && $path === '/api/admin/import') {
        require_admin($db);
        $body = read_json_body();
        $incoming = $body['data'] ?? null;
        if (!is_array($incoming)) {
            send_json(400, ['message' => 'Invalid import payload']);
        }

        $nextDb = [
            'settings' => is_array($incoming['settings'] ?? null) ? $incoming['settings'] : [],
            'users' => is_array($incoming['users'] ?? null) ? $incoming['users'] : [],
            'sessions' => is_array($incoming['sessions'] ?? null) ? $incoming['sessions'] : [],
            'challenges' => is_array($incoming['challenges'] ?? null) ? $incoming['challenges'] : [],
            'solves' => is_array($incoming['solves'] ?? null) ? $incoming['solves'] : [],
            'hintUnlocks' => is_array($incoming['hintUnlocks'] ?? null) ? $incoming['hintUnlocks'] : [],
            'submissions' => is_array($incoming['submissions'] ?? null) ? $incoming['submissions'] : [],
            'announcements' => is_array($incoming['announcements'] ?? null) ? $incoming['announcements'] : [],
            'teams' => is_array($incoming['teams'] ?? null) ? $incoming['teams'] : [],
        ];

        ensure_defaults($nextDb);
        write_db($nextDb);
        send_json(200, ['ok' => true]);
    }

    send_json(404, ['message' => 'Not found']);
}
