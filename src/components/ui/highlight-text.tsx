import React from 'react';

export function HighlightText({ text = '', queries = [] }: { text?: string, queries?: string[] }) {
    if (!text) return null;
    if (!queries || queries.length === 0) return <span>{text}</span>;

    // Filter out empty queries
    const validQueries = queries.filter(q => q.trim().length > 0);
    if (validQueries.length === 0) return <span>{text}</span>;

    // Escape regex characters in queries
    const escapedQueries = validQueries.map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedQueries.join('|')})`, 'gi');

    const parts = text.split(regex);

    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                const isMatch = regex.test(part);
                // reset regex index after testing
                regex.lastIndex = 0;

                return isMatch ? (
                    <mark key={i} className="bg-[#fff176] text-inherit bg-opacity-90 px-0.5 rounded-sm shadow-[0_0_0_1px_rgba(255,241,118,1)]">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                );
            })}
        </span>
    );
}

// Helper to highlight an array of skills uniformly
export function HighlightArray({ items = [], queries = [] }: { items?: string[], queries?: string[] }) {
    if (!items || items.length === 0) return null;

    return (
        <>
            {items.map((item, i) => (
                <span key={i} className="text-[13px] bg-[#f7f8f9] text-[#4a5568] px-3 py-1 rounded-[4px] border border-[#e2e8f0]">
                    <HighlightText text={item} queries={queries} />
                </span>
            ))}
        </>
    );
}
