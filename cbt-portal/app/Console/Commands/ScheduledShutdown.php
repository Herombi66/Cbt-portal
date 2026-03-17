<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ScheduledShutdown extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'system:scheduled-shutdown';
    protected $description = 'Checks if a scheduled shutdown is due and deactivates all accounts.';

    public function handle()
    {
        $scheduledAt = \App\Models\SystemSetting::where('key', 'scheduled_shutdown')->value('value');

        if (!$scheduledAt) {
            return;
        }

        // Parse and ensure we're comparing with current server time
        try {
            // Treat the stored string as the system timezone (UTC by default in Laravel)
            // but ensure we compare it correctly with Carbon::now()
            $scheduledTime = \Carbon\Carbon::parse($scheduledAt, config('app.timezone'));
            $now = \Carbon\Carbon::now();

            if ($scheduledTime->lessThanOrEqualTo($now)) {
                \Illuminate\Support\Facades\Log::info("System scheduled shutdown TRIGGERED. Scheduled: " . $scheduledTime->toDateTimeString() . " | Now: " . $now->toDateTimeString());
                $this->info("Scheduled shutdown time reached. Current time: " . $now->toDateTimeString());

                \Illuminate\Support\Facades\DB::transaction(function () {
                    // Deactivate all students
                    \App\Models\Student::query()->update(['is_active' => false]);

                    // Deactivate all non-super_admin users
                    \App\Models\User::where('role', '!=', 'super_admin')->update(['is_active' => false]);
                    
                    // Revoke tokens for everyone EXCEPT super_admins
                    // Students
                    \Illuminate\Support\Facades\DB::table('personal_access_tokens')
                        ->where('tokenable_type', \App\Models\Student::class)
                        ->delete();
                    
                    // Regular Admins
                    $regularAdminIds = \App\Models\User::where('role', '!=', 'super_admin')->pluck('id');
                    \Illuminate\Support\Facades\DB::table('personal_access_tokens')
                        ->where('tokenable_type', \App\Models\User::class)
                        ->whereIn('tokenable_id', $regularAdminIds)
                        ->delete();
                    
                    // Clear the scheduled shutdown setting
                    \App\Models\SystemSetting::where('key', 'scheduled_shutdown')->delete();
                });

                $this->info('All accounts deactivated and tokens revoked.');
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Scheduled shutdown error: " . $e->getMessage());
        }
    }
}
