# Bookstore API Project
## A RESTful API service for managing a bookstore with book management, search, and administrative capabilities

## Project Files
- `main.bal` - Main service implementation with HTTP endpoints for book management and admin functions
- `types.bal` - Type definitions for the API including Book, BookRequest, and other data structures

---

## File Name: main.bal

### Imports
- `ballerina/http`
- `ballerina/time`
- `ballerina/uuid`

---

### Configurable Variables
- `servicePort` - [int] - `8080`
- `serviceName` - [string] - `"Bookstore API"`
- `maxBooksPerPage` - [int] - `10`
- `debugMode` - [boolean] - `false`

### Module Level Variables
- `totalRequests` - [int]
- `serviceStartTime` - [time:Utc]
- `bookCategories` - [map<BookCategory>]
- `bookStore` - [map<Book>]

---

### Functions

* **validateAndFormatBook**
* **Comments**: Utility function to validate and format book data
* **Parameters**:
    * **Input Parameter**:
        * `bookRequest` - [BookRequest]
* **Returns**: `Book|error`

---

### Services

HTTP Service: `/bookstore` on port `servicePort 8080`

### Endpoints

#### `/bookstore/books`

* **GET**
* **Parameters**:
    * **Query Parameter**:
        * `page` - [int] - Default: 1
        * `limit` - [int] - Default: maxBooksPerPage
* **Returns**: `PaginatedBooks|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Successfully retrieved books
    - `500 Internal Server Error` - Server error occurred

#### `/bookstore/books/[string bookId]`

* **GET**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - [string]
* **Returns**: `Book|http:NotFound|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Book found and returned
    - `404 Not Found` - Book not found
    - `500 Internal Server Error` - Server error occurred

* **POST /bookstore/books**
* **Parameters**:
    * **Body Parameter**:
        * `bookRequest` - [BookRequest]
* **Returns**: `http:Created|http:BadRequest|http:InternalServerError`
* **Status Codes**:
    - `201 Created` - Book successfully created
    - `400 Bad Request` - Invalid book data
    - `500 Internal Server Error` - Server error occurred

* **PUT /bookstore/books/[string bookId]**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - [string]
    * **Body Parameter**:
        * `bookRequest` - [BookRequest]
* **Returns**: `Book|http:NotFound|http:BadRequest|http:InternalServerError`

* **DELETE /bookstore/books/[string bookId]**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - [string]
* **Returns**: `http:NoContent|http:NotFound|http:InternalServerError`

* **POST /bookstore/books/search**
* **Parameters**:
    * **Body Parameter**:
        * `searchCriteria` - [BookSearchCriteria]
* **Returns**: `Book[]|http:InternalServerError`

* **GET /bookstore/health**
* **Returns**: `map<string>`

HTTP Service: `/admin` on port `servicePort 8080`

* **GET /admin/stats**
* **Returns**: `ServiceStats`

* **POST /admin/categories**
* **Parameters**:
    * **Body Parameter**:
        * `category` - [BookCategory]
* **Returns**: `http:Created|http:BadRequest`

* **GET /admin/categories**
* **Returns**: `BookCategory[]`

---

## File Name: types.bal

### Imports
None

### Type Definitions

* **Book**
* **Fields**:
    * `id` - [string]
    * `title` - [string]
    * `author` - [string]
    * `isbn` - [string]
    * `price` - [decimal]
    * `quantity` - [int]

* **BookRequest**
* **Fields**:
    * `title` - [string]
    * `author` - [string]
    * `isbn` - [string]
    * `price` - [decimal]
    * `quantity` - [int]

* **ErrorResponse**
* **Fields**:
    * `message` - [string]

* **PaginatedBooks**
* **Fields**:
    * `books` - [Book[]]
    * `totalCount` - [int]
    * `currentPage` - [int]
    * `totalPages` - [int]

* **BookSearchCriteria**
* **Fields**:
    * `title` - [string?]
    * `author` - [string?]
    * `isbn` - [string?]
    * `minPrice` - [decimal?]
    * `maxPrice` - [decimal?]

* **ServiceStats**
* **Fields**:
    * `totalRequests` - [int]
    * `totalBooks` - [int]
    * `serviceStartTime` - [string]
    * `serviceName` - [string]
    * `debugMode` - [boolean]

* **BookCategory**
* **Fields**:
    * `categoryId` - [string]
    * `categoryName` - [string]
    * `description` - [string]