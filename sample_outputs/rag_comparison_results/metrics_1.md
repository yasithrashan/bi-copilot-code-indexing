# RAG Systems Metrics Matrix - Document 1

**Generated:** 2025-10-13T20:45:03.869Z
**Query:** "Add support for multiple notification channels like SMS (Twilio) and Slack. Use a pluggable design to choose channels for customer and admin alerts, and add retry and fallback when one fails."

---

## 📊 Quality Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Overall Score** | 45/100 | 75/100 | 65/100 | FAISS | 10.00 pts |
| **Precision** | 8.00% | 9.00% | 8.00% | FAISS | 1.00% |
| **Recall** | 75.00% | 100.00% | 100.00% | FAISS | 25.00% |
| **F1-Score** | 14.30% | 17.00% | 15.00% | FAISS | 2.00% |
| **Relevant Chunks** | 6/75 | 7/75 | 6/75 | FAISS | - |

---

## ⚡ Performance Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Retrieval Time** | 1021.61ms | 8.75ms | 4.28ms | SQLite | -1017.33ms |
| **Total Query Time** | 1021.62ms | 8.76ms | 4.28ms | SQLite | -1017.34ms |
| **Time/Chunk** | 13.62ms | 0.12ms | 0.06ms | SQLite | - |

---

## 🎯 Chunk Score Distribution

### Pinecone
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.6098 | public function sendAdminNotification(CustomerFeedback feedb... |
| 2 | 0.5774 | configurable string adminEmail = "";... |
| 3 | 0.5448 | gmail:MessageRequest messageRequest = {         to: [adminEm... |
| 4 | 0.5420 | function generateAdminEmailBody(CustomerFeedback feedback, i... |
| 5 | 0.5325 | string emailSubject = string `New Customer Feedback Received... |

**Average Score:** 0.4501


### FAISS
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.6103 | public function sendAdminNotification(CustomerFeedback feedb... |
| 2 | 0.5777 | configurable string adminEmail = "";... |
| 3 | 0.5451 | gmail:MessageRequest messageRequest = {         to: [adminEm... |
| 4 | 0.5418 | function generateAdminEmailBody(CustomerFeedback feedback, i... |
| 5 | 0.5330 | string emailSubject = string `New Customer Feedback Received... |

**Average Score:** 0.4503


### SQLite
| Rank | Score | Preview |
|------|-------|----------|
| 1 | 0.6103 | public function sendAdminNotification(CustomerFeedback feedb... |
| 2 | 0.5777 | configurable string adminEmail = "";... |
| 3 | 0.5451 | gmail:MessageRequest messageRequest = {         to: [adminEm... |
| 4 | 0.5418 | function generateAdminEmailBody(CustomerFeedback feedback, i... |
| 5 | 0.5330 | string emailSubject = string `New Customer Feedback Received... |

**Average Score:** 0.4503


---

## 📈 Performance vs Quality Trade-off

| System | Quality Rank | Speed Rank | Balanced Score* |
|--------|-------------|-----------|----------------|
| Pinecone | 3 | 3 | 0.315 |
| FAISS | 1 | 2 | 0.822 |
| SQLite | 2 | 1 | 0.754 |

*Balanced Score = (Quality × 0.7) + (Speed × 0.3)

---

## 🏆 Summary

- **Quality Leader:** FAISS
- **Speed Leader:** SQLite
- **Best Precision:** FAISS
- **Best Recall:** FAISS
- **Most Efficient:** SQLite

---

*This metrics matrix provides quantitative comparison. See comparison_1.md for detailed qualitative analysis.*
