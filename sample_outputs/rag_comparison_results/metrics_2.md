# RAG Systems Metrics Matrix - Document 2

**Generated:** 2025-10-13T20:45:27.330Z
**Query:** "Replace the current validation with a new framework that supports custom rules (like email or profanity checks), detailed field errors, severity levels, and rate limiting per user."

---

## 📊 Quality Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Overall Score** | 75/100 | 75/100 | 65/100 | Pinecone | 10.00 pts |
| **Precision** | 8.60% | 7.00% | 10.00% | SQLite | 1.40% |
| **Recall** | 100.00% | 100.00% | 100.00% | Pinecone | Infinity% |
| **F1-Score** | 15.90% | 13.00% | 18.00% | SQLite | 2.10% |
| **Relevant Chunks** | 6/70 | 5/70 | 7/70 | SQLite | - |

---

## ⚡ Performance Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Retrieval Time** | 519.88ms | 5.32ms | 2.32ms | SQLite | -517.56ms |
| **Total Query Time** | 519.88ms | 5.32ms | 2.33ms | SQLite | -517.55ms |
| **Time/Chunk** | 7.43ms | 0.08ms | 0.03ms | SQLite | - |

---

## 🎯 Chunk Score Distribution

### Pinecone
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.5790 | function validateFeedback(CustomerFeedback feedback) returns... |
| 2 | 0.5312 | ErrorResponse errorResponse = {                 'error: "Inv... |
| 3 | 0.5293 | resource function post submit(http:Caller caller, http:Reque... |
| 4 | 0.5290 | ErrorResponse errorResponse = {                 'error: "Val... |
| 5 | 0.5148 | public type EmailData record {|     string customerName;    ... |

**Average Score:** 0.4507


### FAISS
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.5791 | function validateFeedback(CustomerFeedback feedback) returns... |
| 2 | 0.5313 | ErrorResponse errorResponse = {                 'error: "Inv... |
| 3 | 0.5299 | resource function post submit(http:Caller caller, http:Reque... |
| 4 | 0.5293 | ErrorResponse errorResponse = {                 'error: "Val... |
| 5 | 0.5148 | public type EmailData record {|     string customerName;    ... |

**Average Score:** 0.4507


### SQLite
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.5791 | function validateFeedback(CustomerFeedback feedback) returns... |
| 2 | 0.5313 | ErrorResponse errorResponse = {                 'error: "Inv... |
| 3 | 0.5299 | resource function post submit(http:Caller caller, http:Reque... |
| 4 | 0.5293 | ErrorResponse errorResponse = {                 'error: "Val... |
| 5 | 0.5148 | public type EmailData record {|     string customerName;    ... |

**Average Score:** 0.4507


---

## 📈 Performance vs Quality Trade-off

| System | Quality Rank | Speed Rank | Balanced Score* |
|--------|-------------|-----------|----------------|
| Pinecone | 1 | 3 | 0.525 |
| FAISS | 1 | 2 | 0.822 |
| SQLite | 3 | 1 | 0.754 |

*Balanced Score = (Quality × 0.7) + (Speed × 0.3)

---

## 🏆 Summary

- **Quality Leader:** Pinecone
- **Speed Leader:** SQLite
- **Best Precision:** SQLite
- **Best Recall:** Pinecone
- **Most Efficient:** SQLite

---

*This metrics matrix provides quantitative comparison. See comparison_2.md for detailed qualitative analysis.*
