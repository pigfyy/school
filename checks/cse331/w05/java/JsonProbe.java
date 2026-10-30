import java.util.*;
/** The json method of Lecture 12's Guestbook.java, as the notes print it (lines 87 to 95), and a main that prints it on each argument list. */
public class JsonProbe {
    /** @return the strings as a JSON array, each in double quotes */
    private static String json(List<String> strings) {
        List<String> quoted = new ArrayList<String>();
        for (String s : strings) {
            quoted.add("\"" + s.replace("\\", "\\\\")
                .replace("\"", "\\\"").replace("\n", "\\n") + "\"");
        }
        return "[" + String.join(", ", quoted) + "]";
    }

    public static void main(String[] args) {
        System.out.println(json(List.of("ada: hello", "bob: hi")));
        System.out.println(json(List.of("Eve: say \"hi\"")));
    }
}
