# Bookstore API Project
## This is a RESTful API project for managing a bookstore with book management, search, and administrative functions.

## Project Files
- `main.bal` - Main service implementation with book management and admin endpoints
- `types.bal` - Type definitions for the API models and responses

---

## File Name: main.bal

### Imports
- `import ballerina/http;`
- `import ballerina/time;`
- `import ballerina/uuid;`

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

#### `/bookstore/books`

* **GET**
* **Parameters**:
    * **Query Parameter**:
        * `page` - [int] - Default: 1
        * `limit` - [int] - Default: maxBooksPerPage
* **Returns**: `PaginatedBooks|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Success
    - `500 Internal Server Error` - Server error

#### `/bookstore/books/[string bookId]`

* **GET**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - [string]
* **Returns**: `Book|http:NotFound|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Book found
    - `404 Not Found` - Book not found
    - `500 Internal Server Error` - Server error

* **PUT**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - [string]
    * **Body Parameter**:
        * `bookRequest` - [BookRequest]
* **Returns**: `Book|http:NotFound|http:BadRequest|http:InternalServerError`

* **DELETE**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - [string]
* **Returns**: `http:NoContent|http:NotFound|http:InternalServerError`

#### `/bookstore/books/search`

* **POST**
* **Parameters**:
    * **Body Parameter**:
        * `searchCriteria` - [BookSearchCriteria]
* **Returns**: `Book[]|http:InternalServerError`

#### `/bookstore/health`

* **GET**
* **Returns**: `map<string>`

HTTP Service: `/admin` on port `servicePort 8080`

#### `/admin/stats`

* **GET**
* **Returns**: `ServiceStats`

#### `/admin/categories`

* **POST**
* **Parameters**:
    * **Body Parameter**:
        * `category` - [BookCategory]
* **Returns**: `http:Created|http:BadRequest`

* **GET**
* **Returns**: `BookCategory[]`

---

## File Name: types.bal

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