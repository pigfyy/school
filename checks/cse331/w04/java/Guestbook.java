import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * A guestbook on the web, the way the web worked in the 1990s: one
 * page, one form, and no JavaScript.
 *
 * Run it, then visit http://localhost:9331/ in a browser. The page
 * lists the messages posted so far and ends in a form: a name, a
 * message, and a Post button. Posting adds the message and shows
 * the page again. The messages last only while the program runs.
 * The terminal prints each request as it arrives.
 *
 * Two kinds of request reach the program:
 *   GET /    the browser asks for the page; nothing changes
 *   POST /   the browser sends the form's fields; a message is added
 */
public class Guestbook {
    // The one book, shared by every request the server handles.
    private static Book book = new Book();

    public static void main(String[] args) throws IOException {
        HttpServer server =
            HttpServer.create(new InetSocketAddress(9331), 0);
        server.createContext("/", Guestbook::handle);
        server.start();
        System.out.println("Serving at http://localhost:9331/");
    }

    /**
     * @modifies book
     * @effects answers one request: prints its method and path; on
     *     a POST, adds the message the form sent; then sends the
     *     page as the response
     */
    private static void handle(HttpExchange exchange)
            throws IOException {
        String method = exchange.getRequestMethod();
        System.out.println(method + " " + exchange.getRequestURI());

        // On a POST, the body holds the form's fields:
        // add the message the visitor posted.
        if (method.equals("POST")) {
            byte[] bytes = exchange.getRequestBody().readAllBytes();
            String body = new String(bytes, StandardCharsets.UTF_8);
            Map<String, String> fields = parseForm(body);
            book.add(fields.get("name"), fields.get("message"));
        }

        // The response: a header, the status and the body's
        // length, then the body, the page as bytes.
        byte[] page = page().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders()
            .set("Content-Type", "text/html; charset=utf-8");
        exchange.sendResponseHeaders(200, page.length);
        exchange.getResponseBody().write(page);
        exchange.close();
    }

    /**
     * @requires body is what a form sends: name=value pairs joined
     *     by &, each value encoded as a browser encodes it
     * @return the pairs as a map from each name to its decoded value
     */
    private static Map<String, String> parseForm(String body) {
        Map<String, String> fields = new HashMap<String, String>();
        for (String pair : body.split("&")) {
            String[] parts = pair.split("=", 2);
            String name = URLDecoder.decode(parts[0],
                StandardCharsets.UTF_8);
            String value = parts.length < 2 ? "" :
                URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
            fields.put(name, value);
        }
        return fields;
    }

    /** @return the page: the book's messages, then the form */
    private static String page() {
        String html = "<html><body>\n<h1>Guestbook</h1>\n<ul>\n";
        for (String message : book.messages()) {
            html += "<li>" + message + "</li>\n";
        }
        html += "</ul>\n"
            + "<form method=\"POST\" action=\"/\">\n"
            + "Name: <input name=\"name\">\n"
            + "Message: <input name=\"message\">\n"
            + "<button>Post</button>\n"
            + "</form>\n</body></html>\n";
        return html;
    }
}

/** The messages posted so far, oldest first. */
class Book {
    private List<String> messages = new ArrayList<String>();

    /**
     * @modifies this
     * @effects adds the message, signed with the name, after the
     *     messages already posted
     */
    public void add(String name, String message) {
        messages.add(name + ": " + message);
    }

    /** @return the posted messages, oldest first, in a new list */
    public List<String> messages() {
        // A copy, so that a client cannot change the book through it.
        return new ArrayList<String>(messages);
    }
}
