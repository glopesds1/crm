import React from 'react';

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">{title}</h3>
    {children}
  </div>
);
