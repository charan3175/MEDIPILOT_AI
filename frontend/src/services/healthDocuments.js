export function filterHealthDocuments(documents, filters) {
  const query = filters.search.trim().toLowerCase();

  return documents
    .filter((document) => filters.category === "ALL" || document.documentType === filters.category)
    .filter((document) => filters.processing === "ALL" || document.processingStatus === filters.processing)
    .filter((document) => filters.review === "ALL" || document.reviewStatus === filters.review)
    .filter((document) => {
      const date = document.reportDate || document.createdAt;
      if (filters.dateFrom && (!date || new Date(date) < new Date(`${filters.dateFrom}T00:00:00`))) return false;
      if (filters.dateTo && (!date || new Date(date) > new Date(`${filters.dateTo}T23:59:59.999`))) return false;
      if (!query) return true;
      const terms = [
        document.originalName,
        document.documentType,
        document.processingStatus,
        document.processingMessage,
        ...(document.extractedData || []).flatMap((item) => [item.testName, item.originalValue, item.unit, item.sourceLine]),
        ...(document.extractedClinicalData || []).flatMap((item) => [item.label, item.value, item.sourceLine]),
      ];
      return terms.some((term) => String(term || "").toLowerCase().includes(query));
    })
    .sort((left, right) => {
      const leftUploadDate = new Date(left.createdAt || 0).getTime();
      const rightUploadDate = new Date(right.createdAt || 0).getTime();
      const leftReportDate = new Date(left.reportDate || left.createdAt || 0).getTime();
      const rightReportDate = new Date(right.reportDate || right.createdAt || 0).getTime();
      return filters.sort === "oldest"
        ? leftUploadDate - rightUploadDate
        : filters.sort === "report-date"
          ? rightReportDate - leftReportDate
          : rightUploadDate - leftUploadDate;
    });
}
