import React, { useState } from "react";

import { PROJECT_TARGET_AUDIENCE_OPTIONS } from "../../../constants/projectOptions";

const ALL_VALUE = 'all';
// Specific (non-"all") options drive the multi-select chips.
const specificOptions = PROJECT_TARGET_AUDIENCE_OPTIONS.filter((o) => o.value !== ALL_VALUE);
const allOption = PROJECT_TARGET_AUDIENCE_OPTIONS.find((o) => o.value === ALL_VALUE)!;

interface AudienceI {
    // Stable English values, e.g. ["all"] or ["kids", "teens"].
    selectedAudience: string[];
    setSelectedAudience: React.Dispatch<React.SetStateAction<string[]>>;
}

interface ChipProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, active, onClick }) => {
    const [hover, setHover] = useState(false);

    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 18px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
    };

    const activeStyle: React.CSSProperties = {
        background: hover ? 'rgba(251, 191, 36, 0.18)' : 'rgba(251, 191, 36, 0.12)',
        border: '1px solid #FBBF24',
        color: '#FBBF24',
        boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)',
    };

    const inactiveStyle: React.CSSProperties = {
        background: hover ? 'rgba(148, 163, 184, 0.06)' : 'transparent',
        border: `1px solid ${hover ? '#475569' : '#334155'}`,
        color: '#CBD5E1',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ ...baseStyle, ...(active ? activeStyle : inactiveStyle) }}
            aria-pressed={active}
        >
            {label}
        </button>
    );
};

const AudienceSelect: React.FC<AudienceI> = ({ selectedAudience, setSelectedAudience }) => {
    const handleAudienceClick = (value: string) => {
        if (value === ALL_VALUE) {
            // Tap "Все" — collapse to ["all"]; tapping it again does nothing.
            setSelectedAudience([ALL_VALUE]);
            return;
        }
        setSelectedAudience((prev) => {
            // Drop the implicit "all" when picking a specific group.
            const withoutAll = prev.filter((v) => v !== ALL_VALUE);
            const next = withoutAll.includes(value)
                ? withoutAll.filter((v) => v !== value)
                : [...withoutAll, value];
            // Empty selection isn't meaningful — fall back to "all".
            return next.length === 0 ? [ALL_VALUE] : next;
        });
    };

    const isAllActive = selectedAudience.includes(ALL_VALUE);

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Chip
                label={allOption.label}
                active={isAllActive}
                onClick={() => handleAudienceClick(ALL_VALUE)}
            />
            {specificOptions.map((opt) => (
                <Chip
                    key={opt.value}
                    label={opt.label}
                    active={!isAllActive && selectedAudience.includes(opt.value)}
                    onClick={() => handleAudienceClick(opt.value)}
                />
            ))}
        </div>
    );
};

export default AudienceSelect;
