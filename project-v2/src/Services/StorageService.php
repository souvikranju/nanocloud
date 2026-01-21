<?php
/**
 * Storage Service
 * 
 * Handles storage-related operations like calculating disk usage,
 * free space, and storage metrics.
 */

declare(strict_types=1);

namespace NanoCloud\Services;

use NanoCloud\Core\Config;

class StorageService
{
    /**
     * Get storage information for the storage root
     * 
     * @return array Storage metrics including total, free, used bytes and percentage
     */
    public function getStorageInfo(): array
    {
        $storageRoot = Config::get('STORAGE_ROOT');
        
        $total = @disk_total_space($storageRoot);
        $free = @disk_free_space($storageRoot);
        
        if ($total === false) {
            $total = 0;
        }
        if ($free === false) {
            $free = 0;
        }
        
        $used = max(0, $total - $free);
        $percent = ($total > 0) ? ($used / $total * 100.0) : 0.0;
        
        return [
            'totalBytes' => (int)$total,
            'freeBytes' => (int)$free,
            'usedBytes' => (int)$used,
            'usedPercent' => $percent
        ];
    }
    
    /**
     * Check if there's enough free space for a file
     * 
     * @param int $requiredBytes Required space in bytes
     * @return bool True if enough space available
     */
    public function hasEnoughSpace(int $requiredBytes): bool
    {
        $storageRoot = Config::get('STORAGE_ROOT');
        $free = @disk_free_space($storageRoot);
        
        if ($free === false) {
            return false;
        }
        
        return $free >= $requiredBytes;
    }
}
