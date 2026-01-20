
import React, { useState, useEffect } from 'react';
import { listAllSpreadsheets } from '../services/googleSheetsService';
import { LegacyModal, LegacyButton } from './legacy-ui-export';
import type { JournalSheet } from '../types';

interface DrivePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (sheet: JournalSheet) => void;
}

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [files, setFiles] = useState<JournalSheet[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadFiles();
        }
    }, [isOpen]);

    const loadFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const sheets = await listAllSpreadsheets();
            setFiles(sheets);
        } catch (err) {
            console.error(err);
            setError('Failed to load files from Google Drive.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LegacyModal isOpen={isOpen} onClose={onClose} title="Select a Journal">
            <div className="min-h-[300px] max-h-[60vh] overflow-y-auto">
                {loading && (
                    <div className="flex justify-center p-8">
                         <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}
                
                {!loading && !error && files.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        <p>No spreadsheets found in your Google Drive.</p>
                    </div>
                )}

                <div className="space-y-2">
                    {files.map(file => (
                        <button
                            key={file.id}
                            onClick={() => onSelect(file)}
                            className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600 flex items-center"
                        >
                            <span className="text-xl mr-3">📊</span>
                            <span className="font-medium text-slate-900 dark:text-white truncate">{file.name}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <LegacyButton variant="secondary" onClick={onClose}>Cancel</LegacyButton>
            </div>
        </LegacyModal>
    );
};
