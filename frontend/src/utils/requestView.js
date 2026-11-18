export const sanitizeRequestTitle = (title) => String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);

export const buildHelpDraft = (title) => `Hi, I saw your Community Request about ${sanitizeRequestTitle(title)}. I may be able to help.`;

export const buildHelpChatState = (request) => ({
  selectedUserId: request.user._id,
  communityRequestContext: {
    requestId: request._id,
    title: sanitizeRequestTitle(request.title),
    draft: buildHelpDraft(request.title)
  }
});

export const getRequestAction = (request, currentUserId) => {
  if (request?.status !== 'open') return 'none';
  return request.user?._id === currentUserId ? 'close' : 'offer-help';
};

export const preserveExistingDraft = (currentDraft, suggestedDraft) => currentDraft || suggestedDraft;
