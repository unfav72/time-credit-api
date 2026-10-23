<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class SkillController {
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
        $stmt = $pdo->prepare('INSERT INTO skills (name, category_id, description) VALUES (:name, :category_id, :description)');
        try {
            $stmt->execute([
                'name' => $name,
                'category_id' => $categoryId,
                'description' => $description
            ]);
            $skillId = Database::getLastInsertId($pdo, 'skills');
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
            $sql .= ' AND (so.title LIKE :search OR s.name LIKE :search OR so.description LIKE :search) ';
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
        $stmt = $pdo->prepare("
            INSERT INTO service_offers (teacher_id, skill_id, title, description, duration_minutes, credit_rate, experience_level, language, mode, status)
            VALUES (:teacher_id, :skill_id, :title, :description, :duration_minutes, :credit_rate, :experience_level, :language, :mode, 'active')
        ");
        $stmt->execute([
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

        $offerId = Database::getLastInsertId($pdo, 'service_offers');
        AuthMiddleware::jsonResponse(['message' => 'Service offer created successfully', 'id' => $offerId], 201);
    }

    /**
     * GET /api/v1/skills/matches
     * DBMS Demonstration: Multi-table relational self-join to match members offering skills with members seeking them!
     */
    public static function matches(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare("
            SELECT 
                s.name AS skill_name,
                c.name AS category_name,
                teacher.id AS teacher_id,
                teacher.full_name AS teacher_name,
                teacher.email AS teacher_email,
                so.id AS offer_id,
                so.title AS offer_title,
                so.credit_rate,
                so.duration_minutes
            FROM user_skills want
            JOIN skills s ON want.skill_id = s.id
            JOIN skill_categories c ON s.category_id = c.id
            JOIN user_skills offer ON offer.skill_id = want.skill_id AND offer.skill_type = 'OFFER'
            JOIN users teacher ON offer.user_id = teacher.id
            LEFT JOIN service_offers so ON so.teacher_id = teacher.id AND so.skill_id = s.id AND so.status = 'active'
            WHERE want.user_id = :current_user_id 
              AND want.skill_type = 'WANT'
              AND teacher.id <> :current_user_id
            ORDER BY s.name ASC
        ");
        $stmt->execute(['current_user_id' => $user['id']]);
        AuthMiddleware::jsonResponse(['matches' => $stmt->fetchAll()]);
    }
}
