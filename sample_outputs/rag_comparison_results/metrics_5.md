# RAG Systems Metrics Matrix - Document 5

**Generated:** 2025-10-13T20:46:35.639Z
**Query:** "Add GraphQL support next to REST APIs. Include queries with filters, mutations for submissions, and subscriptions for live updates. Use DataLoader to avoid N+1 queries and limit query complexity."

---

## 📊 Quality Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Overall Score** | 72/100 | 25/100 | 35/100 | Pinecone | 37.00 pts |
| **Precision** | 15.70% | 13.00% | 13.30% | Pinecone | 2.40% |
| **Recall** | 81.30% | 100.00% | 78.60% | FAISS | 18.70% |
| **F1-Score** | 26.10% | 23.00% | 22.80% | Pinecone | 3.10% |
| **Relevant Chunks** | 13/83 | 11/83 | 11/83 | Pinecone | - |

---

## ⚡ Performance Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Retrieval Time** | 621.45ms | 8.26ms | 1.85ms | SQLite | -619.60ms |
| **Total Query Time** | 621.45ms | 8.26ms | 1.85ms | SQLite | -619.60ms |
| **Time/Chunk** | 7.49ms | 0.10ms | 0.02ms | SQLite | - |

---

## 🎯 Chunk Score Distribution

### Pinecone
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.5660 | resource function post submit(http:Caller caller, http:Reque... |
| 2 | 0.5302 | stream<FeedbackRecord, sql:Error?> feedbackStream = dbClient... |
| 3 | 0.5056 | FeedbackRecord[]|error feedbacks = getAllFeedback();... |
| 4 | 0.5019 | resource function get all(http:Caller caller, http:Request r... |
| 5 | 0.4993 | map<anydata>|error stats = getFeedbackStats();... |

**Average Score:** 0.4558


### FAISS
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.5658 | resource function post submit(http:Caller caller, http:Reque... |
| 2 | 0.5298 | stream<FeedbackRecord, sql:Error?> feedbackStream = dbClient... |
| 3 | 0.5054 | FeedbackRecord[]|error feedbacks = getAllFeedback();... |
| 4 | 0.5015 | resource function get all(http:Caller caller, http:Request r... |
| 5 | 0.4991 | map<anydata>|error stats = getFeedbackStats();... |

**Average Score:** 0.4555


### SQLite
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.5658 | resource function post submit(http:Caller caller, http:Reque... |
| 2 | 0.5298 | stream<FeedbackRecord, sql:Error?> feedbackStream = dbClient... |
| 3 | 0.5054 | FeedbackRecord[]|error feedbacks = getAllFeedback();... |
| 4 | 0.5015 | resource function get all(http:Caller caller, http:Request r... |
| 5 | 0.4991 | map<anydata>|error stats = getFeedbackStats();... |

**Average Score:** 0.4555


---

## 📈 Performance vs Quality Trade-off

| System | Quality Rank | Speed Rank | Balanced Score* |
|--------|-------------|-----------|----------------|
| Pinecone | 1 | 3 | 0.504 |
| FAISS | 3 | 2 | 0.471 |
| SQLite | 2 | 1 | 0.544 |

*Balanced Score = (Quality × 0.7) + (Speed × 0.3)

---

## 🏆 Summary

- **Quality Leader:** Pinecone
- **Speed Leader:** SQLite
- **Best Precision:** Pinecone
- **Best Recall:** FAISS
- **Most Efficient:** SQLite

---

*This metrics matrix provides quantitative comparison. See comparison_5.md for detailed qualitative analysis.*
