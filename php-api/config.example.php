<?php
/**
 * Copie para `config.php` e preencha (não commite `config.php`).
 */
return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'consorte_db',
        'user' => 'seu_usuario',
        'pass' => 'sua_senha',
        'charset' => 'utf8mb4',
    ],
    /**
     * Lista de origens permitidas (GitHub Pages + Vite local).
     * Ou uma única string em `cors_origin` (legado).
     */
    'cors_origins' => [
        'https://ruanfreire.github.io',
        'https://consorte.fwh.is',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
];
