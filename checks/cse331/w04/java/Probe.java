import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Supplier;

/**
 * Runs the lectures' seven HelpQueue tests (Lecture 10's five spec tests, A to E, and ListQueueImplTest's two, F and
 * G) as plain Java on whichever copy of a class is on the classpath, and prints the letters that fail. Also runs a
 * few one-off probes for verify.mjs. usage: java Probe tests ClassName | java Probe ctor ClassName | java Probe misc
 */
public class Probe {
    static boolean eq(Object a, Object b) { return Objects.equals(a, b); }
    static boolean throwsA(Class<?> c, Runnable r) { try { r.run(); return false; } catch (Throwable e) { return c.isInstance(e); } }

    static String tests(Supplier<HelpQueue> make) {
        StringBuilder fail = new StringBuilder();
        // A studentsAreServedInTheOrderTheyJoined
        try { HelpQueue q = make.get(); q.join("ada"); q.join("bob");
            if (!(eq(List.of("ada", "bob"), q.waiting()) && eq("ada", q.next()) && eq(List.of("bob"), q.waiting()) && q.size() == 1)) fail.append('A');
        } catch (Throwable e) { fail.append('A'); }
        // B nobodyIsInTheQueueTwice
        try { HelpQueue q = make.get(); q.join("ada");
            if (!(throwsA(IllegalArgumentException.class, () -> q.join("ada")) && eq(List.of("ada"), q.waiting()))) fail.append('B');
        } catch (Throwable e) { fail.append('B'); }
        // C aStudentWhoLeftMayComeBack
        try { HelpQueue q = make.get(); q.join("ada"); q.next(); q.join("ada");
            if (!eq(List.of("ada"), q.waiting())) fail.append('C');
        } catch (Throwable e) { fail.append('C'); }
        // D nextOnAnEmptyQueueThrows
        try { HelpQueue q = make.get(); if (!throwsA(NoSuchElementException.class, q::next)) fail.append('D'); } catch (Throwable e) { fail.append('D'); }
        // E waitingIsACopy
        try { HelpQueue q = make.get(); q.join("ada"); List<String> copy = q.waiting(); copy.add("eve");
            if (!eq(List.of("ada"), q.waiting())) fail.append('E');
        } catch (Throwable e) { fail.append('E'); }
        // F joinTwiceSaysWho
        try { HelpQueue q = make.get(); q.join("ada");
            try { q.join("ada"); fail.append('F'); } catch (IllegalArgumentException e) { if (!eq("ada is in the queue", e.getMessage())) fail.append('F'); }
        } catch (Throwable e) { fail.append('F'); }
        // G waitingIsAnArrayList
        try { HelpQueue q = make.get(); q.join("ada"); if (!(q.waiting() instanceof ArrayList)) fail.append('G'); } catch (Throwable e) { fail.append('G'); }
        return fail.length() == 0 ? "none" : fail.toString();
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("tests") || args[0].equals("ctor")) {
            Class<?> cls = Class.forName(args[1]);
            Supplier<HelpQueue> make = () -> { try { return (HelpQueue) cls.getDeclaredConstructor().newInstance(); } catch (Exception e) { throw new RuntimeException(e); } };
            if (args[0].equals("tests")) { System.out.println(tests(make)); return; }
            // FastQueueTest's aQueueMadeFromAListIsItsOwn
            try {
                List<String> netids = new ArrayList<String>(List.of("ada"));
                HelpQueue q = (HelpQueue) cls.getDeclaredConstructor(List.class).newInstance(netids);
                netids.add("eve");
                System.out.println(eq(List.of("ada"), q.waiting()) ? "pass" : "fail");
            } catch (Throwable e) { Throwable c = e.getCause() != null ? e.getCause() : e; System.out.println("fail " + c); }
            return;
        }
        // misc probes
        System.out.println("decode=" + URLDecoder.decode("hello+world+%26+tea", StandardCharsets.UTF_8));
        int x = 47, y = 0, passes = 0;
        while (x >= 10) { y = y + 1; x = x - 10; passes++; }
        System.out.println("divideByTen47=" + y + "," + x + "," + passes);
    }
}
