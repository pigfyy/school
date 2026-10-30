import java.lang.reflect.Field;
import java.util.*;

/**
 * Runs operations on one HelpQueue class (whichever copy is on the classpath) and prints, after each, the result
 * and the fields, read by reflection. verify.mjs compares the output with site/cse331/w04/queue-sim.js.
 * usage: java QueueHarness ClassName < ops    (one op per line: "join ada", "next", "size", "waiting";
 *        a line "new" starts a fresh queue)
 */
public class QueueHarness {
    public static void main(String[] args) throws Exception {
        Class<?> cls = Class.forName(args[0]);
        Scanner in = new Scanner(System.in);
        HelpQueue q = (HelpQueue) cls.getDeclaredConstructor().newInstance();
        while (in.hasNextLine()) {
            String[] op = in.nextLine().trim().split(" ");
            if (op[0].isEmpty()) continue;
            if (op[0].equals("new")) { q = (HelpQueue) cls.getDeclaredConstructor().newInstance(); System.out.println("new"); continue; }
            String result;
            try {
                switch (op[0]) {
                    case "join": q.join(op[1]); result = "null"; break;
                    case "next": result = q.next(); break;
                    case "size": result = String.valueOf(q.size()); break;
                    default: result = q.waiting().toString(); break;
                }
            } catch (RuntimeException e) {
                result = "!" + e.getClass().getSimpleName() + ": " + e.getMessage();
            }
            System.out.println(String.join(" ", op) + " -> " + result + " | " + fields(q));
        }
    }

    static String fields(Object q) throws Exception {
        List<String> out = new ArrayList<>();
        for (Field f : q.getClass().getDeclaredFields()) {
            f.setAccessible(true);
            Object v = f.get(q);
            if (v instanceof Set) {
                List<String> s = new ArrayList<>();
                for (Object o : (Set<?>) v) s.add(String.valueOf(o));
                Collections.sort(s);
                out.add(f.getName() + "={" + String.join(", ", s) + "}");
            } else if (v != null && v.getClass().getSimpleName().equals("Node")) {
                List<String> chain = new ArrayList<>();
                Object n = v;
                while (n != null) {
                    Field id = n.getClass().getDeclaredField("netid"), next = n.getClass().getDeclaredField("next");
                    id.setAccessible(true);
                    next.setAccessible(true);
                    chain.add((String) id.get(n));
                    n = next.get(n);
                }
                out.add(f.getName() + "=" + String.join(" > ", chain));
            } else {
                out.add(f.getName() + "=" + v);
            }
        }
        return String.join("; ", out);
    }
}
