# Bookstore API Project
## A RESTful API service for managing a bookstore's inventory with administrative capabilities

## Project Files
- `main.bal` - Main service implementation with bookstore and admin endpoints
- `types.bal` - Type definitions for the bookstore domain models

---

## File Name: main.bal

### Imports
- `import ballerina/http;`
- `import ballerina/time;`
- `import ballerina/uuid;`

---

### Configurable Variables
- `servicePort` - int - `8080`
- `serviceName` - string - `"Bookstore API"`
- `maxBooksPerPage` - int - `10`
- `debugMode` - boolean - `false`

### Module Level Variables
- `totalRequests` - int
- `serviceStartTime` - time:Utc
- `bookCategories` - map<BookCategory>
- `bookStore` - map<Book>

---

### Functions

* **validateAndFormatBook**
* **Comments**: Utility function to validate and format book data
* **Parameters**:
    * **Input Parameter**:
        * `bookRequest` - BookRequest - None
* **Returns**: `Book|error`

---

### Services

HTTP Service: `/bookstore` on port `servicePort 8080`

### Endpoints

#### `/bookstore/books`

* **GET**
* **Parameters**:
    * **Query Parameter**:
        * `page` - int - Default: 1
        * `limit` - int - Default: maxBooksPerPage
* **Returns**: `PaginatedBooks|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Successfully returns paginated books
    - `500 Internal Server Error` - Server error

#### `/bookstore/books/{bookId}`

* **GET**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - string
* **Returns**: `Book|http:NotFound|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Book found
    - `404 Not Found` - Book not found
    - `500 Internal Server Error` - Server error

* **PUT**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - string
    * **Body Parameter**:
        * `bookRequest` - BookRequest
* **Returns**: `Book|http:NotFound|http:BadRequest|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Book updated
    - `400 Bad Request` - Invalid request
    - `404 Not Found` - Book not found
    - `500 Internal Server Error` - Server error

* **DELETE**
* **Parameters**:
    * **Path Parameter**:
        * `bookId` - string
* **Returns**: `http:NoContent|http:NotFound|http:InternalServerError`
* **Status Codes**:
    - `204 No Content` - Book deleted
    - `404 Not Found` - Book not found
    - `500 Internal Server Error` - Server error

#### `/bookstore/books/search`

* **POST**
* **Parameters**:
    * **Body Parameter**:
        * `searchCriteria` - BookSearchCriteria
* **Returns**: `Book[]|http:InternalServerError`
* **Status Codes**:
    - `200 OK` - Search results returned
    - `500 Internal Server Error` - Server error

#### `/bookstore/health`

* **GET**
* **Returns**: `map<string>`
* **Status Codes**:
    - `200 OK` - Health status returned

---

HTTP Service: `/admin` on port `servicePort 8080`

#### `/admin/stats`

* **GET**
* **Returns**: `ServiceStats`
* **Status Codes**:
    - `200 OK` - Statistics returned

#### `/admin/categories`

* **POST**
* **Parameters**:
    * **Body Parameter**:
        * `category` - BookCategory
* **Returns**: `http:Created|http:BadRequest`
* **Status Codes**:
    - `201 Created` - Category created
    - `400 Bad Request` - Invalid category

* **GET**
* **Returns**: `BookCategory[]`
* **Status Codes**:
    - `200 OK` - Categories returned

---

## File Name: types.bal

### Imports
None

### Type Definitions

* **Book**
* **Fields**:
    * `id` - string
    * `title` - string
    * `author` - string
    * `isbn` - string
    * `price` - decimal
    * `quantity` - int

* **BookRequest**
* **Fields**:
    * `title` - string
    * `author` - string
    * `isbn` - string
    * `price` - decimal
    * `quantity` - int

* **ErrorResponse**
* **Fields**:
    * `message` - string

* **PaginatedBooks**
* **Fields**:
    * `books` - Book[]
    * `totalCount` - int
    * `currentPage` - int
    * `totalPages` - int

* **BookSearchCriteria**
* **Fields**:
    * `title` - string?
    * `author` - string?
    * `isbn` - string?
    * `minPrice` - decimal?
    * `maxPrice` - decimal?

* **ServiceStats**
* **Fields**:
    * `totalRequests` - int
    * `totalBooks` - int
    * `serviceStartTime` - string
    * `serviceName` - string
    * `debugMode` - boolean

* **BookCategory**
* **Fields**:
    * `categoryId` - string
    * `categoryName` - string
    * `description` - string