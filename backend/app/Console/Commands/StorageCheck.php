<?php

namespace App\Console\Commands;

use App\Services\StorageHealthService;
use Illuminate\Console\Command;

class StorageCheck extends Command
{
    protected $signature = 'locale:storage-check';

    protected $description = 'Prova salvataggio e visualizzazione delle immagini (disco public / Supabase)';

    public function handle(StorageHealthService $service): int
    {
        $result = $service->check();
        $this->line("Driver: {$result['driver']} · limiti PHP: upload {$result['php_limits']['upload_max_filesize']}, post {$result['php_limits']['post_max_size']}");
        foreach ($result['steps'] as $step => $outcome) {
            $outcome['ok'] ? $this->info("✓ {$step}: {$outcome['message']}") : $this->error("✗ {$step}: {$outcome['message']}");
        }
        $result['ok'] ? $this->info($result['summary']) : $this->warn($result['summary']);

        return $result['ok'] ? self::SUCCESS : self::FAILURE;
    }
}
