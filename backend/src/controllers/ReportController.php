<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class ReportController {
    /**
     * GET /api/v1/reports/popular-skills
     */
    public static function popularSkills(): void {
        $pdo = Database::getCoreConnection();
        $stmt = $pdo->query("
            SELECT s.id, s.name AS skill_name, c.name AS category_name,
                   COUNT(DISTINCT so.id) AS total_offers,
                   COUNT(DISTINCT sr.id) AS total_requests,
                   ROUND(COALESCE(AVG(r.rating)::numeric, 5.0), 1) AS average_rating
            FROM skills s
            JOIN skill_categories c ON s.category_id = c.id
            LEFT JOIN service_offers so ON s.id = so.skill_id
            LEFT JOIN service_requests sr ON so.id = sr.offer_id
            LEFT JOIN sessions sess ON sr.id = sess.request_id AND sess.status = 'COMPLETED'
            LEFT JOIN reviews r ON sess.id = r.session_id
            GROUP BY s.id, s.name, c.name
            ORDER BY total_requests DESC, total_offers DESC
            LIMIT 10
        ");
        AuthMiddleware::jsonResponse(['popular_skills' => $stmt->fetchAll()]);
    }

    /**
     * GET /api/v1/reports/teacher-leaderboard
     */
    public static function teacherLeaderboard(): void {
        $pdo = Database::getCoreConnection();
        $stmt = $pdo->query("
            SELECT u.id AS teacher_id, u.full_name AS teacher_name, u.email,
                   COUNT(DISTINCT s.id) AS completed_sessions,
                   ROUND(COALESCE(SUM(s.eligible_duration_minutes) / 60.0, 0)::numeric, 1) AS total_hours_taught,
                   ROUND(COALESCE(AVG(r.rating)::numeric, 5.0), 1) AS average_rating,
                   ca.balance AS current_balance
            FROM users u
            JOIN sessions s ON u.id = s.teacher_id AND s.status = 'COMPLETED'
            LEFT JOIN reviews r ON s.id = r.session_id AND r.reviewed_user_id = u.id
            LEFT JOIN credit_accounts ca ON u.id = ca.user_id
            GROUP BY u.id, u.full_name, u.email, ca.balance
            ORDER BY completed_sessions DESC, total_hours_taught DESC
            LIMIT 10
        ");
        AuthMiddleware::jsonResponse(['leaderboard' => $stmt->fetchAll()]);
    }

    /**
     * GET /api/v1/reports/platform-metrics
     */
    public static function platformMetrics(): void {
        $pdo = Database::getCoreConnection();

        $metrics = [];

        // Users count
        $metrics['total_users'] = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        // Skills count
        $metrics['total_skills'] = (int)$pdo->query('SELECT COUNT(*) FROM skills')->fetchColumn();
        // Sessions completed
        $metrics['completed_sessions'] = (int)$pdo->query("SELECT COUNT(*) FROM sessions WHERE status = 'COMPLETED'")->fetchColumn();
        // Total minutes exchanged
        $metrics['total_minutes_exchanged'] = (int)$pdo->query("SELECT COALESCE(SUM(eligible_duration_minutes), 0) FROM sessions WHERE status = 'COMPLETED'")->fetchColumn();
        // Total TimeCredits in circulation
        $metrics['total_credits_in_circulation'] = (float)$pdo->query('SELECT COALESCE(SUM(balance), 0) FROM credit_accounts')->fetchColumn();
        // Ledger entry count
        $metrics['total_ledger_entries'] = (int)$pdo->query('SELECT COUNT(*) FROM credit_ledger_entries')->fetchColumn();

        AuthMiddleware::jsonResponse(['metrics' => $metrics]);
    }
}
