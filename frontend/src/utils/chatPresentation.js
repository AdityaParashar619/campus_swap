export const getMessageBubbleClasses = (own) => own
  ? 'rounded-br-md border border-blue-700 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600'
  : 'rounded-bl-md border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export const getConversationClasses = (selected) => selected
  ? 'border-blue-300 bg-blue-50 text-slate-950 dark:border-blue-700 dark:bg-blue-950/50 dark:text-white'
  : 'border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800';
