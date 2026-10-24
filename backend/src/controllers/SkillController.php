<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class SkillController {
    /**
     * GET /api/v1/skills
     */
    public static function index(): void {
        self::listSkills();
    }

    /**
     * GET /api/v1/skills
     */
    public static function listSkills(): void {
        $pdo = Database::getCoreConnection();
        $stmt = $pdo->query("
            SELECT s.id, s.name, s.description, s.created_at,
                   c.id AS category_id, c.name AS category_name, c.icon AS category_icon,
                   (SELECT COUNT(*) FROM user_skills WHERE skill_id = s.id AND skill_type = 'OFFER') AS offer_count,
                   (SELECT COUNT(*) FROM user_skills WHERE skill_id = s.id AND skill_type = 'WANT') AS want_count
            FROM skills s
            JOIN skill_categories c ON s.category_id = c.id
            ORDER BY c.name ASC, s.name ASC
        ");
        AuthMiddleware::jsonResponse(['skills' => $stmt->fetchAll()]);
    }

    /**
     * GET /api/v1/categories
     */
    public static function categories(): void {
        $pdo = Database::getCoreConnection();
        $stmt = $pdo->query('SELECT * FROM skill_categories ORDER BY name ASC');
        AuthMiddleware::jsonResponse(['categories' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/v1/skills
     */
    public static function createSkill(): void {
        AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $name = trim($input['name'] ?? '');
        $categoryId = (int)($input['category_id'] ?? 0);
        $description = trim($input['description'] ?? '');

        if (empty($name) || $categoryId <= 0) {
            AuthMiddleware::jsonResponse(['error' => 'Skill name and valid category are required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        try {
            $skillId = Database::insertAndGetId($pdo, 'INSERT INTO skills (name, category_id, description) VALUES (:name, :category_id, :description)', [
                'name' => $name,
                'category_id' => $categoryId,
                'description' => $description
            ]);
            AuthMiddleware::jsonResponse(['message' => 'Skill created successfully', 'id' => $skillId], 201);
        } catch (\PDOException $e) {
            AuthMiddleware::jsonResponse(['error' => 'Skill already exists or invalid category.'], 400);
        }
    }

    /**
     * GET /api/v1/offers
     */
    public static function browseOffers(): void {
        $category = $_GET['category'] ?? null;
        $search = $_GET['search'] ?? null;
        $pdo = Database::getCoreConnection();

        $sql = "
            SELECT so.id, so.title, so.description, so.duration_minutes, so.credit_rate,
                   so.experience_level, so.language, so.mode, so.status, so.created_at,
                   u.id AS teacher_id, u.full_name AS teacher_name, u.email AS teacher_email,
                   s.id AS skill_id, s.name AS skill_name,
                   c.id AS category_id, c.name AS category_name,
                   ROUND(COALESCE(AVG(r.rating)::numeric, 5.0), 1) AS teacher_rating,
                   COUNT(DISTINCT r.id) AS review_count
            FROM service_offers so
            JOIN users u ON so.teacher_id = u.id
            JOIN skills s ON so.skill_id = s.id
            JOIN skill_categories c ON s.category_id = c.id
            LEFT JOIN reviews r ON r.reviewed_user_id = u.id
            WHERE so.status = 'active'
        ";

        $params = [];
        if ($category) {
            $sql .= ' AND c.name = :category ';
            $params['category'] = $category;
        }
        if ($search) {
            $sql .= ' AND (so.title ILIKE :search OR s.name ILIKE :search OR so.description ILIKE :search) ';
            $params['search'] = '%' . $search . '%';
        }

        $sql .= ' GROUP BY so.id, u.id, u.full_name, u.email, s.id, s.name, c.id, c.name ORDER BY so.created_at DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        AuthMiddleware::jsonResponse(['offers' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/v1/offers
     */
    public static function createOffer(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $skillId = (int)($input['skill_id'] ?? 0);
        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $durationMinutes = (int)($input['duration_minutes'] ?? 60);
        $creditRate = (float)($input['credit_rate'] ?? 1.00);
        $experienceLevel = $input['experience_level'] ?? 'intermediate';
        $language = $input['language'] ?? 'English';
        $mode = $input['mode'] ?? 'online';

        if (empty($title) || $skillId <= 0) {
            AuthMiddleware::jsonResponse(['error' => 'Title and skill are required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $offerId = Database::insertAndGetId($pdo, "
            INSERT INTO service_offers (teacher_id, skill_id, title, description, duration_minutes, credit_rate, experience_level, language, mode, status)
            VALUES (:teacher_id, :skill_id, :title, :description, :duration_minutes, :credit_rate, :experience_level, :language, :mode, 'active')
        ", [
            'teacher_id' => $user['id'],
            'skill_id' => $skillId,
            'title' => $title,
            'description' => $description,
            'duration_minutes' => $durationMinutes,
            'credit_rate' => $creditRate,
            'experience_level' => $experienceLevel,
            'language' => $language,
            'mode' => $mode
        ]);

        // Also ensure user_skills has an OFFER record
        $bridge = $pdo->prepare("
            INSERT INTO user_skills (user_id, skill_id, skill_type, experience_level)
            VALUES (:uid, :sid, 'OFFER', :exp)
            ON CONFLICT (user_id, skill_id, skill_type) DO NOTHING
        ");
        $bridge->execute(['uid' => $user['id'], 'sid' => $skillId, 'exp' => $experienceLevel]);

        AuthMiddleware::jsonResponse(['message' => 'Service offer created successfully', 'id' => $offerId], 201);
    }

    /**
     * GET /api/v1/user/skills
     * Retrieve offered and wanted skills for current user.
     */
    public static function getUserSkills(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare("
            SELECT us.id, us.skill_id, us.skill_type, us.experience_level, us.created_at,
                   s.name AS skill_name, s.description,
                   c.id AS category_id, c.name AS category_name
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            JOIN skill_categories c ON s.category_id = c.id
            WHERE us.user_id = :uid
            ORDER BY us.created_at DESC
        ");
        $stmt->execute(['uid' => $user['id']]);
        $rows = $stmt->fetchAll();

        $offered = array_filter($rows, fn($r) => $r['skill_type'] === 'OFFER');
        $wanted = array_filter($rows, fn($r) => $r['skill_type'] === 'WANT');

        AuthMiddleware::jsonResponse([
            'offered' => array_values($offered),
            'wanted' => array_values($wanted)
        ]);
    }

    /**
     * POST /api/v1/user/skills
     * Add offered or wanted skill.
     */
    public static function addUserSkill(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $skillId = (int)($input['skill_id'] ?? 0);
        $skillType = strtoupper(trim($input['skill_type'] ?? 'OFFER'));
        $experienceLevel = $input['experience_level'] ?? 'intermediate';

        if ($skillId <= 0 || !in_array($skillType, ['OFFER', 'WANT'], true)) {
            AuthMiddleware::jsonResponse(['error' => 'Valid skill_id and skill_type (OFFER/WANT) required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $stmt = $pdo->prepare("
            INSERT INTO user_skills (user_id, skill_id, skill_type, experience_level)
            VALUES (:uid, :sid, :stype, :exp)
            ON CONFLICT (user_id, skill_id, skill_type) 
            DO UPDATE SET experience_level = EXCLUDED.experience_level
        ");
        $stmt->execute([
            'uid' => $user['id'],
            'sid' => $skillId,
            'stype' => $skillType,
            'exp' => $experienceLevel
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Skill preference saved successfully.']);
    }

    /**
     * DELETE /api/v1/user/skills/{id}
     */
    public static function removeUserSkill(int $id): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('DELETE FROM user_skills WHERE id = :id AND user_id = :uid');
        $stmt->execute(['id' => $id, 'uid' => $user['id']]);

        AuthMiddleware::jsonResponse(['message' => 'Skill removed successfully.']);
    }

    /**
     * GET /api/v1/users/{id}/profile
     * Public profile of another member (does not leak private passwords or tokens).
     */
    public static function getPublicProfile(int $targetUserId): void {
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('
            SELECT u.id, u.full_name, u.role, u.bio, u.created_at,
                   (SELECT COUNT(*) FROM sessions WHERE teacher_id = u.id AND status = \'COMPLETED\') AS completed_sessions,
                   ROUND(COALESCE(AVG(r.rating)::numeric, 5.0), 1) AS rating,
                   COUNT(DISTINCT r.id) AS review_count
            FROM users u
            LEFT JOIN reviews r ON r.reviewed_user_id = u.id
            WHERE u.id = :id AND u.status = \'active\'
            GROUP BY u.id
        ');
        $stmt->execute(['id' => $targetUserId]);
        $profile = $stmt->fetch();

        if (!$profile) {
            AuthMiddleware::jsonResponse(['error' => 'Member profile not found.'], 404);
            return;
        }

        // Skills offered and wanted
        $skillsStmt = $pdo->prepare("
            SELECT us.skill_type, us.experience_level, s.id AS skill_id, s.name AS skill_name, c.name AS category_name
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            JOIN skill_categories c ON s.category_id = c.id
            WHERE us.user_id = :id
        ");
        $skillsStmt->execute(['id' => $targetUserId]);
        $skills = $skillsStmt->fetchAll();

        // Active offers
        $offersStmt = $pdo->prepare("
            SELECT so.id, so.title, so.description, so.duration_minutes, so.credit_rate, so.experience_level,
                   s.name AS skill_name
            FROM service_offers so
            JOIN skills s ON so.skill_id = s.id
            WHERE so.teacher_id = :id AND so.status = 'active'
        ");
        $offersStmt->execute(['id' => $targetUserId]);
        $offers = $offersStmt->fetchAll();

        // Recent reviews
        $revStmt = $pdo->prepare("
            SELECT r.rating, r.comment, r.created_at, rev.full_name AS reviewer_name
            FROM reviews r
            JOIN users rev ON r.reviewer_id = rev.id
            WHERE r.reviewed_user_id = :id
            ORDER BY r.created_at DESC
            LIMIT 10
        ");
        $revStmt->execute(['id' => $targetUserId]);
        $reviews = $revStmt->fetchAll();

        AuthMiddleware::jsonResponse([
            'profile' => $profile,
            'skills' => $skills,
            'offers' => $offers,
            'reviews' => $reviews
        ]);
    }

    /**
     * GET /api/v1/skills/matches
     * DBMS Demonstration: Multi-table relational self-join to match members offering skills with members seeking them!
     */
    public static function matches(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare("
            SELECT DISTINCT
                s.id AS skill_id,
                s.name AS skill_name,
                c.name AS category_name,
                teacher.id AS teacher_id,
                teacher.full_name AS teacher_name,
                teacher.email AS teacher_email,
                teacher.bio AS teacher_bio,
                COALESCE(offer.experience_level, so.experience_level, 'intermediate') AS experience_level,
                so.id AS offer_id,
                COALESCE(so.title, '1-on-1 Mentorship & Teaching') AS offer_title,
                COALESCE(so.credit_rate, 1.00) AS credit_rate,
                COALESCE(so.duration_minutes, 60) AS duration_minutes
            FROM user_skills want
            JOIN skills s ON want.skill_id = s.id
            JOIN skill_categories c ON s.category_id = c.id
            LEFT JOIN user_skills offer ON offer.skill_id = want.skill_id AND offer.skill_type = 'OFFER'
            LEFT JOIN service_offers so ON so.skill_id = s.id AND so.status = 'active'
            JOIN users teacher ON (teacher.id = offer.user_id OR teacher.id = so.teacher_id)
            WHERE want.user_id = :current_user_id 
              AND want.skill_type = 'WANT'
              AND teacher.id <> :current_user_id
            ORDER BY s.name ASC, teacher.full_name ASC
        ");
        $stmt->execute(['current_user_id' => $user['id']]);
        AuthMiddleware::jsonResponse(['matches' => $stmt->fetchAll()]);
    }
}
