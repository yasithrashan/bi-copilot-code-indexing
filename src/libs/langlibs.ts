import type { Library } from "./libs_types";

export const LANGLIBS: Library[] = [
  {
    name: "ballerina/lang.runtime",
    description:
      "The `lang.runtime` module provides functions related to the language runtime that are not specific to a particular basic type.",
    typeDefs: [
      {
        functions: [],
        name: "DynamicListener",
        description: "",
        type: "Class",
      },
      { functions: [], name: "StackFrame", description: "", type: "Class" },
    ],
    clients: [],
    functions: [
      {
        name: "sleep",
        type: "Normal Function",
        description:
          "Halts the current strand for a predefined amount of time.\n\n```ballerina\nruntime:sleep(5);\n```",
        parameters: [
          {
            name: "seconds",
            description: "An amount of time to sleep in seconds",
            type: { name: "decimal" },
          },
        ],
        return: { type: { name: "nil" } },
      },
    ],
  },
  {
    name: "ballerina/lang.value",
    description:
      "The `lang.value` module provides functions that work on values of more than one basic type.",
    typeDefs: [
      {
        members: [],
        name: "Cloneable",
        description:
          "The type of value to which `clone` and `cloneReadOnly` can be applied.",
        type: "Union",
      },
      {
        members: [],
        name: "JsonFloat",
        description: "Subtype of `json` that allows only float numbers.",
        type: "Union",
      },
      {
        members: [],
        name: "JsonDecimal",
        description: "Subtype of `json` that allows only decimal numbers.",
        type: "Union",
      },
      { members: [], name: "Type", description: "", type: "Union" },
    ],
    clients: [],
    functions: [
      {
        name: "cloneWithType",
        type: "Normal Function",
        description:
          'Constructs a value with a specified type by cloning another value.\n\nWhen parameter `v` is a structural value, the inherent type of the value to be constructed\ncomes from parameter `t`. When parameter `t` is a union, it must be possible to determine which\nmember of the union to use for the inherent type by following the same rules\nthat are used by list constructor expressions and mapping constructor expressions\nwith the contextually expected type. If not, then an error is returned.\nThe `cloneWithType` operation is recursively applied to each member of parameter `v` using\nthe type descriptor that the inherent type requires for that member.\n\nLike the Clone abstract operation, this does a deep copy, but differs in\nthe following respects:\n- the inherent type of any structural values constructed comes from the specified\ntype descriptor rather than the value being constructed\n- the read-only bit of values and fields comes from the specified type descriptor\n- the graph structure of `v` is not preserved; the result will always be a tree;\nan error will be returned if `v` has cycles\n- immutable structural values are copied rather being returned as is; all\nstructural values in the result will be mutable.\n- numeric values can be converted using the NumericConvert abstract operation\n- if a record type descriptor specifies default values, these will be used\nto supply any missing members\n\n```ballerina\nanydata[] arr = [1, 2, 3, 4];\nint[] intArray = check arr.cloneWithType();\nintArray ⇒ [1,2,3,4]\narr === intArray ⇒ false\ntype Vowels string:Char[];\nstring[] vowels = ["a", "e", "i", "o", "u"];\nvowels.cloneWithType(Vowels) ⇒ ["a","e","i","o","u"]\nvowels.cloneWithType(string) ⇒ error\n```',
        parameters: [
          {
            name: "v",
            description: "the value to be cloned",
            type: { name: "anydata" },
          },
          {
            name: "t",
            description: "the type for the cloned to be constructed",
            type: { name: "typedesc<anydata>" },
            default: "<>",
          },
        ],
        return: {
          description:
            "a new value that belongs to parameter `t`, or an error if this cannot be done",
          type: { name: "t|error" },
        },
      },
      {
        name: "ensureType",
        type: "Normal Function",
        description:
          'Safely casts a value to a type.\n\nThis casts a value to a type in the same way as a type cast expression,\nbut returns an error if the cast cannot be done, rather than panicking.\n\n```ballerina\njson student = {name: "Jo", subjects: ["CS1212", "CS2021"]};\njson[] subjects = check student.subjects.ensureType();\nsubjects ⇒ ["CS1212","CS2021"]\nanydata vowel = "I";\nvowel.ensureType(string:Char) ⇒ I;\nvowel.ensureType(int) ⇒ error\n```',
        parameters: [
          {
            name: "v",
            description: "the value to be cast",
            type: { name: "any|error" },
          },
          {
            name: "t",
            description: "a typedesc for the type to which to cast it",
            type: { name: "typedesc<any>" },
            default: "<>",
          },
        ],
        return: {
          description:
            "`v` cast to the type described by parameter `t`, or an error, if the cast cannot be done",
          type: { name: "t|error" },
        },
      },
      {
        name: "fromJsonString",
        type: "Normal Function",
        description:
          'Parses a string in JSON format and returns the value that it represents.\n\nNumbers in the JSON string are converted into Ballerina values of type\ndecimal except in the following two cases:\nif the JSON number starts with `-` and is numerically equal to zero, then it is\nconverted into float value of `-0.0`;\notherwise, if the JSON number is syntactically an integer and is in the range representable\nby a Ballerina int, then it is converted into a Ballerina int.\nA JSON number is considered syntactically an integer if it contains neither\na decimal point nor an exponent.\n\nReturns an error if the string cannot be parsed.\n\n```ballerina\n"{\\"id\\": 12, \\"name\\": \\"John\\"}".fromJsonString() ⇒ {"id":12,"name":"John"}\n"{12: 12}".fromJsonString() ⇒ error\n```',
        parameters: [
          {
            name: "str",
            description: "string in JSON format",
            type: { name: "string" },
          },
        ],
        return: {
          description: "`str` parsed to json or error",
          type: { name: "json|error" },
        },
      },
      {
        name: "fromJsonStringWithType",
        type: "Normal Function",
        description:
          'Converts a string in JSON format to a user-specified type.\n\nThis is a combination of function `fromJsonString` followed by function `fromJsonWithType`.\n\n```ballerina\nint[] intArray = check "[1, 2, 3, 4]".fromJsonStringWithType(); \nintArray ⇒ [1,2,3,4]\n"2022".fromJsonStringWithType(int) ⇒ 2022\n"2022".fromJsonStringWithType(boolean) ⇒ error\n```',
        parameters: [
          {
            name: "str",
            description: "string in JSON format",
            type: { name: "string" },
          },
          {
            name: "t",
            description: "type to convert to",
            type: { name: "typedesc<anydata>" },
            default: "<>",
          },
        ],
        return: {
          description:
            "value belonging to type parameter `t` or error if this cannot be done",
          type: { name: "t|error" },
        },
      },
      {
        name: "toJson",
        type: "Normal Function",
        description:
          'Converts a value of type `anydata` to `json`.\n\nThis does a deep copy of parameter `v` converting values that do\nnot belong to json into values that do.\nA value of type `xml` is converted into a string as if\nby the `toString` function.\nA value of type `table` is converted into a list of\nmappings one for each row.\nThe inherent type of arrays in the return value will be\n`json[]` and of mappings will be `map<json>`.\nA new copy is made of all structural values, including\nimmutable values.\nThis panics if parameter `v` has cycles.\n\n```ballerina\nanydata student = {name: "Jo", age: 11};\nstudent.toJson() ⇒ {"name":"Jo","age":11}\nanydata[] array = [];\narray.push(array);\narray.toJson() ⇒ panic\n```',
        parameters: [
          {
            name: "v",
            description: "anydata value",
            type: { name: "anydata" },
          },
        ],
        return: {
          description: "representation of `v` as value of type json",
          type: { name: "json" },
        },
      },
      {
        name: "toJsonString",
        type: "Normal Function",
        description:
          'Returns the string that represents a anydata value in JSON format.\n\nparameter `v` is first converted to `json` as if by the function `toJson`.\n\n```ballerina\nanydata marks = {"Alice": 90, "Bob": 85, "Jo": 91};\nmarks.toJsonString() ⇒ {"Alice":90, "Bob":85, "Jo":91}\n```',
        parameters: [
          {
            name: "v",
            description: "anydata value",
            type: { name: "anydata" },
          },
        ],
        return: {
          description:
            "string representation of parameter `v` converted to `json`",
          type: { name: "string" },
        },
      },
      {
        name: "toString",
        type: "Normal Function",
        description:
          'Performs a direct conversion of a value to a string.\n\nThe conversion is direct in the sense that when applied to a value that is already\na string it leaves the value unchanged.\n\nThe details of the conversion are specified by the ToString abstract operation\ndefined in the Ballerina Language Specification, using the direct style.\n\n```ballerina\ndecimal value = 12.12d;\nvalue.toString() ⇒ 12.12\nanydata[] data = [1, "Sam", 12.3f, 12.12d, {value: 12}];\ndata.toString() ⇒ [1,"Sam",12.3,12.12,{"value":12}]\n```',
        parameters: [
          {
            name: "v",
            description: "the value to be converted to a string",
            type: { name: "(any)" },
          },
        ],
        return: {
          description: "a string resulting from the conversion",
          type: { name: "string" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.string",
    description:
      "The `lang.string` module corresponds to the `string` basic type.",
    typeDefs: [
      {
        name: "Char",
        description:
          "Built-in subtype of string containing strings of length 1.",
        type: "string",
      },
    ],
    clients: [],
    functions: [
      {
        name: "'join",
        type: "Normal Function",
        description:
          'Joins zero or more strings together with a separator.\n\n```ballerina\nstring:\'join(" ", "Ballerina", "is", "a", "programming", "language") ⇒ Ballerina is a programming language\nstring[] array = ["John", "23", "USA", "Computer Science", "Swimmer"];\nstring:\'join(",", ...array) ⇒ John,23,USA,Computer Science,Swimmer\n```',
        parameters: [
          {
            name: "separator",
            description: "separator string",
            type: { name: "string" },
          },
          {
            name: "strs",
            description: "strings to be joined",
            type: { name: "strs" },
          },
        ],
        return: {
          description:
            "a string consisting of all of parameter `strs` concatenated in order\nwith parameter `separator` in between them",
          type: { name: "string" },
        },
      },
      {
        name: "codePointCompare",
        type: "Normal Function",
        description:
          'Lexicographically compares strings using their Unicode code points.\n\nThis orders strings in a consistent and well-defined way,\nbut the ordering will often not be consistent with cultural expectations\nfor sorted order.\n\n```ballerina\n"Austria".codePointCompare("Australia") ⇒ 1\n```',
        parameters: [
          {
            name: "str1",
            description: "the first string to be compared",
            type: { name: "string" },
          },
          {
            name: "str2",
            description: "the second string to be compared",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "an int that is less than, equal to or greater than zero,\naccording as parameter `str1` is less than, equal to or greater than parameter `str2`",
          type: { name: "int" },
        },
      },
      {
        name: "endsWith",
        type: "Normal Function",
        description:
          'Tests whether a string ends with another string.\n\n```ballerina\n"Welcome to the Ballerina programming language".endsWith("language") ⇒ true\n```',
        parameters: [
          {
            name: "str",
            description: "the string to be tested",
            type: { name: "string" },
          },
          {
            name: "substr",
            description: "the ending string",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "true if parameter `str` ends with parameter `substr`; false otherwise",
          type: { name: "boolean" },
        },
      },
      {
        name: "fromBytes",
        type: "Normal Function",
        description:
          "Constructs a string from its UTF-8 representation in bytes.\n\n```ballerina\nstring:fromBytes([72, 101, 108, 108, 111, 32, 66, 97, 108, 108, 101, 114, 105, 110, 97, 33]) ⇒ Hello, World!\nstring:fromBytes([149, 169, 224]) ⇒ error\n```",
        parameters: [
          {
            name: "bytes",
            description: "UTF-8 byte array",
            type: { name: "byte[]" },
          },
        ],
        return: {
          description: "parameter `bytes` converted to string or error",
          type: { name: "string|error" },
        },
      },
      {
        name: "fromCodePointInt",
        type: "Normal Function",
        description:
          "Constructs a single character string from a code point.\n\nAn int is a valid code point if it is in the range 0 to 0x10FFFF inclusive,\nbut not in the range 0xD800 or 0xDFFF inclusive.\n\n```ballerina\nstring:fromCodePointInt(97) ⇒ a\nstring:fromCodePointInt(1114113) ⇒ error\n```",
        parameters: [
          {
            name: "codePoint",
            description: "an int specifying a code point",
            type: { name: "int" },
          },
        ],
        return: {
          description:
            "a single character string whose code point is parameter `codePoint`; or an error\nif parameter `codePoint` is not a valid code point",
          type: {
            name: "Char|error",
            links: [{ category: "internal", recordName: "Char" }],
          },
        },
      },
      {
        name: "fromCodePointInts",
        type: "Normal Function",
        description:
          "Constructs a string from an array of code points.\n\nAn int is a valid code point if it is in the range 0 to 0x10FFFF inclusive,\nbut not in the range 0xD800 or 0xDFFF inclusive.\n\n```ballerina\nstring:fromCodePointInts([66, 97, 108, 108, 101, 114, 105, 110, 97]) ⇒ Ballerina\nstring:fromCodePointInts([1114113, 1114114, 1114115]) ⇒ error\n```",
        parameters: [
          {
            name: "codePoints",
            description: "an array of ints, each specifying a code point",
            type: { name: "int[]" },
          },
        ],
        return: {
          description:
            "a string with a character for each code point in parameter `codePoints`; or an error\nif any member of parameter `codePoints` is not a valid code point",
          type: { name: "string|error" },
        },
      },
      {
        name: "getCodePoint",
        type: "Normal Function",
        description:
          'Returns the code point of a character in a string.\n\n```ballerina\n"Hello, World!".getCodePoint(3) ⇒ 108\n```',
        parameters: [
          { name: "str", description: "the string", type: { name: "string" } },
          {
            name: "index",
            description: "an index in parameter `str`",
            type: { name: "int" },
          },
        ],
        return: {
          description:
            "the Unicode code point of the character at parameter `index` in parameter `str`",
          type: { name: "int" },
        },
      },
      {
        name: "includes",
        type: "Normal Function",
        description:
          'Tests whether a string includes another string.\n\n```ballerina\n"Hello World, from Ballerina".includes("Bal") ⇒ true\n"Hello World! from Ballerina".includes("Hello", 10) ⇒ false\n```',
        parameters: [
          {
            name: "str",
            description: "the string in which to search",
            type: { name: "string" },
          },
          {
            name: "substr",
            description: "the string to search for",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description: "index to start searching from",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "`true` if there is an occurrence of parameter `substr` in parameter `str` at an index >= parameter `startIndex`,\nor `false` otherwise",
          type: { name: "boolean" },
        },
      },
      {
        name: "indexOf",
        type: "Normal Function",
        description:
          'Finds the first occurrence of one string in another string.\n\n```ballerina\n"New Zealand".indexOf("land") ⇒ 7\n"Ballerinalang is a unique programming language".indexOf("lang", 15) ⇒ 38\n```',
        parameters: [
          {
            name: "str",
            description: "the string in which to search",
            type: { name: "string" },
          },
          {
            name: "substr",
            description: "the string to search for",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description: "index to start searching from",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "index of the first occurrence of parameter `substr` in parameter `str` that is >= parameter `startIndex`,\nor `()` if there is no such occurrence",
          type: { name: "int?" },
        },
      },
      {
        name: "length",
        type: "Normal Function",
        description:
          'Returns the length of the string.\n\n```ballerina\n"Hello, World!".length() ⇒ 13;\n```',
        parameters: [
          { name: "str", description: "the string", type: { name: "string" } },
        ],
        return: {
          description:
            "the number of characters (code points) in parameter `str`",
          type: { name: "int" },
        },
      },
      {
        name: "startsWith",
        type: "Normal Function",
        description:
          'Tests whether a string starts with another string.\n\n```ballerina\n"Welcome to the Ballerina programming language".startsWith("Welcome") ⇒ true\n```',
        parameters: [
          {
            name: "str",
            description: "the string to be tested",
            type: { name: "string" },
          },
          {
            name: "substr",
            description: "the starting string",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "true if parameter `str` starts with parameter `substr`; false otherwise",
          type: { name: "boolean" },
        },
      },
      {
        name: "substring",
        type: "Normal Function",
        description:
          'Returns a substring of a string.\n\n```ballerina\n"Hello, my name is John".substring(7) ⇒ my name is John\n"Hello, my name is John Anderson".substring(18, 22) ⇒ John\n```',
        parameters: [
          {
            name: "str",
            description: "source string.",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description: "the starting index, inclusive",
            type: { name: "int" },
          },
          {
            name: "endIndex",
            description: "the ending index, exclusive",
            type: { name: "int" },
            default: "str.length()",
          },
        ],
        return: {
          description:
            "substring consisting of characters with index >= `startIndex` and < `endIndex`",
          type: { name: "string" },
        },
      },
      {
        name: "toBytes",
        type: "Normal Function",
        description:
          'Represents a string as an array of bytes using UTF-8.\n\n```ballerina\n"Hello, World!".toBytes() ⇒ [72,101,108,108,111,44,32,87,111,114,108,100,33]\n```',
        parameters: [
          { name: "str", description: "the string", type: { name: "string" } },
        ],
        return: { description: "UTF-8 byte array", type: { name: "byte[]" } },
      },
      {
        name: "toCodePointInt",
        type: "Normal Function",
        description:
          'Converts a single character string to a code point.\n\n```ballerina\nstring:toCodePointInt("a") ⇒ 97\n```',
        parameters: [
          {
            name: "ch",
            description: "a single character string",
            type: {
              name: "Char",
              links: [{ category: "internal", recordName: "Char" }],
            },
          },
        ],
        return: {
          description: "the code point of parameter `ch`",
          type: { name: "int" },
        },
      },
      {
        name: "toCodePointInts",
        type: "Normal Function",
        description:
          'Converts a string to an array of code points.\n\n```ballerina\n"Hello, world 🌎".toCodePointInts() ⇒ [72,101,108,108,111,44,32,119,111,114,108,100,32,127758]\n```',
        parameters: [
          { name: "str", description: "the string", type: { name: "string" } },
        ],
        return: {
          description:
            "an array with a code point for each character of parameter `str`",
          type: { name: "int[]" },
        },
      },
      {
        name: "toLowerAscii",
        type: "Normal Function",
        description:
          'Converts occurrences of A-Z to a-z.\n\nOther characters are left unchanged.\n\n```ballerina\n"HELLO, World!".toLowerAscii() ⇒ hello, world!\n```',
        parameters: [
          {
            name: "str",
            description: "the string to be converted",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "parameter `str` with any occurrences of A-Z converted to a-z",
          type: { name: "string" },
        },
      },
      {
        name: "toUpperAscii",
        type: "Normal Function",
        description:
          'Converts occurrences of a-z to A-Z.\n\nOther characters are left unchanged.\n\n```ballerina\n"hello, World!".toUpperAscii() ⇒ HELLO, WORLD!\n```',
        parameters: [
          {
            name: "str",
            description: "the string to be converted",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "parameter `str` with any occurrences of a-z converted to A-Z",
          type: { name: "string" },
        },
      },
      {
        name: "trim",
        type: "Normal Function",
        description:
          'Removes ASCII white space characters from the start and end of a string.\n\nThe ASCII white space characters are 0x9...0xD, 0x20.\n\n```ballerina\n" Hello World   ".trim() + "!" ⇒ Hello World!\n```',
        parameters: [
          { name: "str", description: "the string", type: { name: "string" } },
        ],
        return: {
          description:
            "parameter `str` with leading or trailing ASCII white space characters removed",
          type: { name: "string" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.boolean",
    description:
      "The `lang.boolean` module corresponds to the `boolean` basic type.",
    typeDefs: [],
    clients: [],
    functions: [
      {
        name: "fromString",
        type: "Normal Function",
        description:
          'Converts a string to a boolean.\n\nReturns the boolean of which parameter `s` is a string representation.\nThe accepted representations are `true`, `false`\n(in any combination of lower- and upper-case),\nand also `1` for true and `0` for `false`.\nThis is the inverse of function ``value:toString`` applied to a `boolean`.\n\n```ballerina\nboolean:fromString("true") ⇒ true\nboolean:fromString("0") ⇒ false\nboolean:fromString("01") ⇒ error\n```',
        parameters: [
          {
            name: "s",
            description: "string representing a boolean value",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "boolean that parameter `s` represents, or an error if there is no such boolean",
          type: { name: "boolean|error" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.error",
    description:
      "The `lang.error` module corresponds to the `error` basic type.",
    typeDefs: [
      {
        fields: [
          { name: "", description: "Rest field", type: { name: "Cloneable" } },
        ],
        name: "Detail",
        description: "The type to which error detail records must belong.",
        type: "Record",
      },
      {
        name: "NoMessage",
        description:
          "Error type representing the no message error in worker interactions.",
        type: "error",
      },
      {
        name: "Retriable",
        description: "A type of error which can be retried.",
        type: "error",
      },
      {
        functions: [],
        name: "DefaultRetryManager",
        description: "",
        type: "Class",
      },
      { functions: [], name: "RetryManager", description: "", type: "Class" },
      { functions: [], name: "StackFrame", description: "", type: "Class" },
      {
        members: [],
        name: "Cloneable",
        description:
          "Type for value that can be cloned.\nThis is the same as in lang.value, but is copied here to avoid a dependency.",
        type: "Union",
      },
    ],
    clients: [],
    functions: [
      {
        name: "message",
        type: "Normal Function",
        description:
          'Returns the error\'s message.\n\n```ballerina\nerror("IO error").message() ⇒ IO error\n```',
        parameters: [
          {
            name: "e",
            description: "the error value",
            type: { name: "error" },
          },
        ],
        return: { description: "error message", type: { name: "string" } },
      },
    ],
  },
  {
    name: "ballerina/lang.float",
    description:
      "The `lang.float` module corresponds to the `float` basic type.",
    typeDefs: [
      {
        value: "2.718281828459045",
        varType: { name: "float" },
        name: "E",
        description: "Euler's number.",
        type: "Constant",
      },
      {
        value: "1.0/0.0",
        varType: { name: "float" },
        name: "Infinity",
        description: "IEEE positive infinity.",
        type: "Constant",
      },
      {
        value: "0.0/0.0",
        varType: { name: "float" },
        name: "NaN",
        description: "IEEE not-a-number value.",
        type: "Constant",
      },
      {
        value: "3.141592653589793",
        varType: { name: "float" },
        name: "PI",
        description: "The number π.",
        type: "Constant",
      },
    ],
    clients: [],
    functions: [
      {
        name: "fromString",
        type: "Normal Function",
        description:
          'Returns the float value represented by a string.\n\nparameter `s` must follow the syntax of DecimalFloatingPointNumber as defined by the Ballerina specification\nwith the following modifications\n- the DecimalFloatingPointNumber may have a leading `+` or `-` sign\n- `NaN` is allowed\n- `Infinity` is allowed with an optional leading `+` or `-` sign\n- a FloatingPointTypeSuffix is not allowed\nThis is the inverse of function ``value:toString`` applied to an `float`.\n\n```ballerina\nfloat:fromString("0.2453") ⇒ 0.2453\nfloat:fromString("-10") ⇒ -10.0\nfloat:fromString("123f") ⇒ error\n```',
        parameters: [
          {
            name: "s",
            description: "string representation of a float",
            type: { name: "string" },
          },
        ],
        return: {
          description: "float value or error",
          type: { name: "float|error" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.decimal",
    description:
      "The `lang.decimal` module corresponds to the `decimal` basic type.",
    typeDefs: [],
    clients: [],
    functions: [
      {
        name: "fromString",
        type: "Normal Function",
        description:
          'Returns the decimal value represented by a string.\n\n`s` must follow the syntax of DecimalFloatingPointNumber as defined by the Ballerina specification\nwith the following modifications\n- the DecimalFloatingPointLiteral may have a leading `+` or `-` sign\n- a FloatingPointTypeSuffix is not allowed\nThis is the inverse of function ``value:toString`` applied to an `decimal`.\n\n```ballerina\ndecimal:fromString("0.2453") ⇒ 0.2453\ndecimal:fromString("-10") ⇒ -10\ndecimal:fromString("123d") ⇒ error\n```',
        parameters: [
          {
            name: "s",
            description: "string representation of a decimal",
            type: { name: "string" },
          },
        ],
        return: {
          description: "decimal representation of the argument or error",
          type: { name: "decimal|error" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.int",
    description: "The `lang.int` module corresponds to the `int` basic type.",
    typeDefs: [
      {
        name: "Signed32",
        description:
          "Built-in subtype that allows signed integers that can be represented in 32 bits using two's complement.\nThis allows an int between -2^31 and 2^31 - 1 inclusive,\ni.e., between -2,147,483,648 and 2,147,483,647 inclusive.",
        type: "int",
      },
      {
        name: "Signed16",
        description:
          "Built-in subtype that allows non-negative integers that can be represented in 16 bits using two's complement.\nThis allows an int between -2^15 and 2^15 - 1 inclusive,\ni.e., between -32,768 and 32,767 inclusive.",
        type: "int",
      },
      {
        name: "Signed8",
        description:
          "Built-in subtype that allows non-negative integers that can be represented in 8 bits using two's complement.\nThis allows an int between -2^7 and 2^7 - 1 inclusive,\ni.e., between -128 and 127 inclusive.",
        type: "int",
      },
      {
        name: "Unsigned32",
        description:
          "Built-in subtype that allows non-negative integers that can be represented in 32 bits.\nThis allows an int between 0 and 2^32 - 1 inclusive,\ni.e., between 0 and 4,294,967,295 inclusive.",
        type: "int",
      },
      {
        name: "Unsigned16",
        description:
          "Built-in subtype that allows non-negative integers that can be represented in 16 bits.\nThis allows an int between 0 and 2^16 - 1 inclusive,\ni.e., between 0 and 65,535 inclusive.",
        type: "int",
      },
      {
        name: "Unsigned8",
        description:
          "Built-in subtype that allows non-negative integers that can be represented in 8 bits.\nThis allows an int between 0 and 2^8 - 1 inclusive,\ni.e., between 0 and 255 inclusive.\nThis is the same as `byte`.",
        type: "int",
      },
      {
        value: "9223372036854775807",
        varType: { name: "int" },
        name: "MAX_VALUE",
        description: "Maximum value of type `int`.",
        type: "Constant",
      },
      {
        value: "-9223372036854775807 - 1",
        varType: { name: "int" },
        name: "MIN_VALUE",
        description: "Minimum value of type `int`.",
        type: "Constant",
      },
      {
        value: "32767",
        varType: { name: "int" },
        name: "SIGNED16_MAX_VALUE",
        description: "Maximum value of type `Signed16`.",
        type: "Constant",
      },
      {
        value: "-32768",
        varType: { name: "int" },
        name: "SIGNED16_MIN_VALUE",
        description: "Minimum value of type `Signed16`.",
        type: "Constant",
      },
      {
        value: "2147483647",
        varType: { name: "int" },
        name: "SIGNED32_MAX_VALUE",
        description: "Maximum value of type `Signed32`.",
        type: "Constant",
      },
      {
        value: "-2147483648",
        varType: { name: "int" },
        name: "SIGNED32_MIN_VALUE",
        description: "Minimum value of type `Signed32`.",
        type: "Constant",
      },
      {
        value: "127",
        varType: { name: "int" },
        name: "SIGNED8_MAX_VALUE",
        description: "Maximum value of type `Signed8`.",
        type: "Constant",
      },
      {
        value: "-128",
        varType: { name: "int" },
        name: "SIGNED8_MIN_VALUE",
        description: "Minimum value of type `Signed8`.",
        type: "Constant",
      },
      {
        value: "65535",
        varType: { name: "int" },
        name: "UNSIGNED16_MAX_VALUE",
        description: "Maximum value of type `Unsigned16`.",
        type: "Constant",
      },
      {
        value: "4294967295",
        varType: { name: "int" },
        name: "UNSIGNED32_MAX_VALUE",
        description: "Maximum value of type `Unsigned32`.",
        type: "Constant",
      },
      {
        value: "255",
        varType: { name: "int" },
        name: "UNSIGNED8_MAX_VALUE",
        description: "Maximum value of type `Unsigned8`.",
        type: "Constant",
      },
    ],
    clients: [],
    functions: [
      {
        name: "fromString",
        type: "Normal Function",
        description:
          'Returns the integer of a string that represents in decimal.\n\nReturns error if parameter `s` is not the decimal representation of an integer.\nThe first character may be `+` or `-`.\nThis is the inverse of function ``value:toString`` applied to an `int`.\n\n```ballerina\nint:fromString("76") ⇒ 76\nint:fromString("-120") ⇒ -120\nint:fromString("0xFFFF") ⇒ error\n```',
        parameters: [
          {
            name: "s",
            description: "string representation of a integer value",
            type: { name: "string" },
          },
        ],
        return: {
          description: "int representation of the argument or error",
          type: { name: "int|error" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.map",
    description:
      "The `lang.map` module corresponds to the `mapping` basic type.",
    typeDefs: [
      {
        members: [],
        name: "Type",
        description:
          "A type parameter that is a subtype of `any|error`.\nHas the special semantic that when used in a declaration\nall uses in the declaration must refer to same type.",
        type: "Union",
      },
      {
        members: [],
        name: "Type1",
        description:
          "A type parameter that is a subtype of `any|error`.\nHas the special semantic that when used in a declaration\nall uses in the declaration must refer to same type.",
        type: "Union",
      },
    ],
    clients: [],
    functions: [
      {
        name: "get",
        type: "Normal Function",
        description:
          'Returns the member of a map with given key.\n\nThis for use in a case where it is known that the map has a specific key,\nand accordingly panics if parameter `m` does not have a member with parameter `k` key.\n\n```ballerina\nmap<int> marks = {"Carl": 85, "Bob": 50, "Max": 60};\nmarks.get("Carl") ⇒ 85\nmarks.get("John") ⇒ panic\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
          { name: "k", description: "the key", type: { name: "string" } },
        ],
        return: {
          description: "member with parameter `k` key",
          type: { name: "any|error" },
        },
      },
      {
        name: "hasKey",
        type: "Normal Function",
        description:
          'Tests whether a map value has a member with a given key.\n\n```ballerina\nmap<int> marks = {"Carl": 85, "Bob": 50, "Max": 60};\nmarks.hasKey("Carl") ⇒ true\nmarks.hasKey("John") ⇒ false\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
          { name: "k", description: "the key", type: { name: "string" } },
        ],
        return: {
          description:
            "true if parameter `m` has a member with key parameter `k`",
          type: { name: "boolean" },
        },
      },
      {
        name: "keys",
        type: "Normal Function",
        description:
          'Returns a list of all the keys of a map.\n\n```ballerina\n{"Carl": 85, "Bob": 50, "Max": 60}.keys() ⇒ ["Carl","Bob","Max"]\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
        ],
        return: {
          description: "a new list of all keys",
          type: { name: "string[]" },
        },
      },
      {
        name: "length",
        type: "Normal Function",
        description:
          'Returns number of members of a map.\n\n```ballerina\n{"Carl": 85, "Bob": 50, "Max": 60}.length() ⇒ 3\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
        ],
        return: {
          description: "number of members in parameter `m`",
          type: { name: "int" },
        },
      },
      {
        name: "remove",
        type: "Normal Function",
        description:
          'Removes a member of a map.\n\nThis removes the member of parameter `m` with key parameter `k` and returns it.\nIt panics if there is no such member.\n\n```ballerina\nmap<int> marks = {"Carl": 85, "Bob": 50, "Max": 60};\nmarks.remove("Carl") ⇒ 85\nmarks ⇒ {"Bob":50,"Max":60}\nmarks.remove("John") ⇒ panic\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
          { name: "k", description: "the key", type: { name: "string" } },
        ],
        return: {
          description: "the member of parameter `m` that had key parameter `k`",
          type: { name: "any|error" },
        },
      },
      {
        name: "removeAll",
        type: "Normal Function",
        description:
          'Removes all members of a map.\n\nThis panics if any member cannot be removed.\n\n```ballerina\nmap<int> marks = {"Carl": 85, "Bob": 50, "Max": 60};\nmarks.removeAll();\nmarks ⇒ {}\nmap<int> values = <record {|int x; int y;|}> {x: 10, y: 20};\nvalues.removeAll() ⇒ panic;\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
        ],
        return: { type: { name: "() " } },
      },
      {
        name: "removeIfHasKey",
        type: "Normal Function",
        description:
          'Removes a member of a map with a given key, if the map has member with the key.\n\nIf parameter `m` has a member with key parameter `k`, it removes and returns it;\notherwise it returns `()`.\n\n```ballerina\nmap<int> marks = {"Carl": 85, "Bob": 50, "Max": 60};\nmarks.removeIfHasKey("Carl") ⇒ 85\nmarks ⇒ {"Bob":50,"Max":60}\nmarks.removeIfHasKey("John") is () ⇒ true\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
          { name: "k", description: "the key", type: { name: "string" } },
        ],
        return: {
          description:
            "the member of parameter `m` that had key parameter `k`, or `()` if parameter `m` does not have a key parameter `k`",
          type: { name: "any|error?" },
        },
      },
      {
        name: "toArray",
        type: "Normal Function",
        description:
          'Returns a list of all the members of a map.\n\n```ballerina\n{"Carl": 85, "Bob": 50, "Max": 60}.toArray() ⇒ [85,50,60]\n```',
        parameters: [
          {
            name: "m",
            description: "the map",
            type: { name: "map<any|error>" },
          },
        ],
        return: {
          description:
            "an array whose members are the members of parameter `m`",
          type: { name: "any|error[]" },
        },
      },
    ],
  },
  {
    name: "ballerina/lang.regexp",
    description:
      "The `lang.regexp` module corresponds to the `regexp` basic type.",
    typeDefs: [
      { functions: [], name: "Span", description: "", type: "Class" },
      {
        members: [],
        name: "Replacement",
        description:
          "The replacement for the match of a regular expression found within a string.\nA string value specifies that the replacement is a fixed string.\nA function that specifies that the replacement is constructed by calling a function for each match.",
        type: "Union",
      },
      {
        members: [],
        name: "Groups",
        description:
          "A list providing detailed information about the match of a regular expression within string.\nEach member of the list identifies the `Span` within the string matched\nby each of the regular expression's capturing groups.\nThe member with index 0 corresponds to the entire regular expression.\nThe group with index i, where i > 1,is the i-th capturing group;\nthis will be nil if the match of the regular expression did not use\na match of the capturing group.\nThe capturing groups within a regular expression are ordered by the position\nof their opening parenthesis.",
        type: "IntersectionType",
      },
    ],
    clients: [],
    functions: [
      {
        name: "find",
        type: "Normal Function",
        description:
          'Returns the first match of a regular expression within a string.\n\n```ballerina\nstring:RegExp r = re `World`;\nr.find("Not A Match") is () ⇒ true\nr.find("Hello World") is regexp:Span ⇒ true\nr.find("Hello World", 6) is regexp:Span ⇒ true\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for a match of `re`",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to start looking for a match",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "a `Span` describing the match, or nil if no match was found",
          type: {
            name: "Span?",
            links: [{ category: "internal", recordName: "Span" }],
          },
        },
      },
      {
        name: "findAll",
        type: "Normal Function",
        description:
          'Returns a list of all the matches of a regular expression within a string.\nAfter one match is found, it looks for the next match starting where the previous\nmatch ended, so the list of matches will be non-overlapping.\n\n```ballerina\nstring:RegExp r = re `[bB].tt[a-z]*`;\nr.findAll("Not A Match").length() ⇒ 0\nr.findAll("Butter was bought by Betty but the butter was bitter.").length() ⇒ 4\nr.findAll("Butter was bought by Betty but the butter was bitter.", 7).length() ⇒ 3\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for matches of `re`",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to start looking for matches",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description: "a list containing a `Span` for each match found",
          type: {
            name: "Span[]",
            links: [{ category: "internal", recordName: "Span" }],
          },
        },
      },
      {
        name: "findAllGroups",
        type: "Normal Function",
        description:
          'Returns the `Groups` of all the matches of a regular expression within a string.\nAfter one match is found, it looks for the next match starting where the previous\nmatch ended, so the list of matches will be non-overlapping.\n\n```ballerina\nstring:RegExp r = re `(([a-z]u)(bble))`;\nr.findAllGroups("Not A Match").length() ⇒ 0\nr.findAllGroups("rubble, trouble, bubble, hubble").length() ⇒ 3\nr.findAllGroups("rubble, trouble, bubble, hubble", 7).length() ⇒ 2\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for matches of `re`",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to start looking for matches",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description: "a list containing a `Group` for each match found",
          type: {
            name: "Groups[]",
            links: [{ category: "internal", recordName: "Groups" }],
          },
        },
      },
      {
        name: "findGroups",
        type: "Normal Function",
        description:
          'Returns the `Groups` for the first match of a regular expression within a string.\n\n```ballerina\nstring:RegExp r = re `([bB].tt[a-z]*)`;\nr.findGroups("Not A Match") is () ⇒ true\nr.findGroups("Butter was bought by Betty but the butter was bitter.") is regexp:Groups ⇒ true\nr.findGroups("Butter was bought by Betty but the butter was bitter.", 7) is regexp:Groups ⇒ true\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for a match of `re`",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to start looking for a match",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "a `Groups` list describing the match, or nil if no match was found",
          type: {
            name: "Groups?",
            links: [{ category: "internal", recordName: "Groups" }],
          },
        },
      },
      {
        name: "fromString",
        type: "Normal Function",
        description:
          'Constructs a regular expression from a string.\nThe syntax of the regular expression is the same as accepted by the `re` tagged data template expression.\n\n```ballerina\nregexp:fromString("AB+C*D{1,4}") ⇒ re `AB+C*D{1,4}`\nregexp:fromString("AB+^*") ⇒ error\n```',
        parameters: [
          {
            name: "str",
            description: "the string representation of a regular expression",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "the regular expression, or an error value if `str` is not a valid regular expression",
          type: {
            name: "RegExp|error",
            links: [{ category: "internal", recordName: "RegExp" }],
          },
        },
      },
      {
        name: "fullMatchGroups",
        type: "Normal Function",
        description:
          'Returns the `Groups` of the match of a regular expression that is a full match of a string.\nA match of the regular expression in a string is a full match if it\nstarts at index 0 and ends at index `n`, where `n` is the length of the string.\n\n```ballerina\nstring:RegExp r = re `([0-9]+)×([0-9]+)`;\nr.fullMatchGroups("test: 1440×900") is () ⇒ true\nr.fullMatchGroups("1440×900") is regexp:Groups ⇒ true\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for a match of `re`",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "a `Groups` list describing the match, or nil if there is not a full match; the\nfirst `Span` in the list will be all of `str`",
          type: {
            name: "Groups?",
            links: [{ category: "internal", recordName: "Groups" }],
          },
        },
      },
      {
        name: "isFullMatch",
        type: "Normal Function",
        description:
          'Tests whether there is full match of regular expression with a string.\nA match of a regular expression in a string is a full match if it\nstarts at index 0 and ends at index `n`, where `n` is the length of the string.\n\n```ballerina\nstring:RegExp r = re `A|Th.*ch|^`;\nr.isFullMatch("This is a Match") ⇒ true\nr.isFullMatch("Not a complete Match") ⇒ false\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          { name: "str", description: "the string", type: { name: "string" } },
        ],
        return: {
          description:
            "true if there is full match of `re` with `str`, and false otherwise",
          type: { name: "boolean" },
        },
      },
      {
        name: "matchAt",
        type: "Normal Function",
        description:
          'Tests whether there is a match of a regular expression at a specific index in the string.\n\n```ballerina\nstring:RegExp r = re `World`;\nr.matchAt("Hello World") is () ⇒ true\nr.matchAt("Hello World", 6) is regexp:Span ⇒ true\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for a match of `re`",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to look for a match; defaults to zero",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "a `Span` describing the match, or nil if `re` did not match at that index; the startIndex of the\n`Span` will always be equal to `startIndex`",
          type: {
            name: "Span?",
            links: [{ category: "internal", recordName: "Span" }],
          },
        },
      },
      {
        name: "matchGroupsAt",
        type: "Normal Function",
        description:
          'Returns the `Groups` of the match of a regular expression at a specific index in the string.\n\n```ballerina\nstring:RegExp r = re `([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])?`;\nr.matchGroupsAt("time: 14:35:59") is () ⇒ true\nr.matchGroupsAt("time: 14:35:59", 6) is regexp:Groups ⇒ true\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to look for a match of `re`",
            type: { name: "string" },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to look for a match; defaults to zero",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "a `Groups` list describing the match, or nil if `re` did not match at that index; the startIndex of the\nfirst `Span` in the list will always be equal to the `startIndex` of the first member of the list",
          type: {
            name: "Groups?",
            links: [{ category: "internal", recordName: "Groups" }],
          },
        },
      },
      {
        name: "replace",
        type: "Normal Function",
        description:
          'Replaces the first match of a regular expression.\n\n```ballerina\nstring:RegExp r = re `0+`;\nr.replace("10010011", "*") ⇒ 1*10011\nr.replace("10010011", "*", 4) ⇒ 1001*11\nr.replace("122111", "*") ⇒ 122111\nr.replace("10010011", replaceFunction) ⇒ 1*10011\nr.replace("10010011", replaceFunction, 4) ⇒ 1001*11\nisolated function replaceFunction(regexp:Groups groups) returns string => "*";\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to perform the replacements",
            type: { name: "string" },
          },
          {
            name: "replacement",
            description:
              "a `Replacement` that gives the replacement for the match",
            type: {
              name: "Replacement",
              links: [{ category: "internal", recordName: "Replacement" }],
            },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to start looking for a match; defaults to zero",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "`str` with the first match, if any, replaced by the string specified by `replacement`",
          type: { name: "string" },
        },
      },
      {
        name: "replaceAll",
        type: "Normal Function",
        description:
          'Replaces all matches of a regular expression.\nAfter one match is found, it looks for the next match starting where the previous\nmatch ended, so the matches will be non-overlapping.\n\n```ballerina\nstring:RegExp r = re `0+`;\nr.replaceAll("10010011", "*") ⇒ 1*1*11\nr.replaceAll("10010011", "*", 4) ⇒ 1001*11\nr.replaceAll("122111", "*") ⇒ 122111\nr.replaceAll("10010011", replaceFunction) ⇒ 121211\nr.replaceAll("10010011", replaceFunction, 4) ⇒ 1001211\nisolated function replaceFunction(regexp:Groups groups) returns string => groups[0].substring().length().toString();\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string in which to perform the replacements",
            type: { name: "string" },
          },
          {
            name: "replacement",
            description:
              "a `Replacement` that gives the replacement for each match",
            type: {
              name: "Replacement",
              links: [{ category: "internal", recordName: "Replacement" }],
            },
          },
          {
            name: "startIndex",
            description:
              "the index within `str` at which to start looking for matches; defaults to zero",
            type: { name: "int" },
            default: "0",
          },
        ],
        return: {
          description:
            "`str` with every match replaced by the string specified by `replacement`",
          type: { name: "string" },
        },
      },
      {
        name: "split",
        type: "Normal Function",
        description:
          'Splits a string into substrings separated by matches of a regular expression.\nThis finds the the non-overlapping matches of a regular expression and\nreturns a list of substrings of `str` that occur before the first match,\nbetween matches, or after the last match.  If there are no matches, then\n`[str]` will be returned.\n\n```ballerina\nstring:RegExp r = re `,`;\nr.split("abc,cde,efg") ⇒ ["abc","cde","efg"]\nr.split("abc cde efg") ⇒ ["abc cde efg"]\n```',
        parameters: [
          {
            name: "re",
            description: "the regular expression that specifies the separator",
            type: {
              name: "RegExp",
              links: [{ category: "internal", recordName: "RegExp" }],
            },
          },
          {
            name: "str",
            description: "the string to be split",
            type: { name: "string" },
          },
        ],
        return: {
          description:
            "a list of substrings of `str` separated by matches of `re`",
          type: { name: "string[]" },
        },
      },
    ],
  },
];
