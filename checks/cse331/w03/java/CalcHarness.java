import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Runs Calculator.main (whichever copy is on the classpath) once per session, inside one JVM, so that
 * verify.mjs can compare thousands of random sessions with the simulator. Sessions arrive on standard input
 * separated by NUL characters. For each, one line goes to standard output:
 * base64(stdout) TAB base64(stderr) TAB status. An exception that leaves main is reported as the JVM's
 * default handler would: "Exception in thread "main" " and the stack trace, down to the Calculator.main frame.
 * verify.mjs also runs curated sessions as real separate processes, so this stand-in is itself checked.
 */
public class CalcHarness {
    public static void main(String[] args) throws Exception {
        byte[] all = System.in.readAllBytes();
        String text = new String(all, StandardCharsets.UTF_8);
        PrintStream realOut = System.out;
        Base64.Encoder b64 = Base64.getEncoder();
        for (String session : text.split("\u0000", -1)) {
            if (session.equals("\u0001")) continue;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ByteArrayOutputStream err = new ByteArrayOutputStream();
            System.setIn(new ByteArrayInputStream(session.getBytes(StandardCharsets.UTF_8)));
            System.setOut(new PrintStream(out, true, StandardCharsets.UTF_8));
            System.setErr(new PrintStream(err, true, StandardCharsets.UTF_8));
            int status = 0;
            try {
                Calculator.main(new String[0]);
            } catch (Throwable e) {
                StringWriter sw = new StringWriter();
                e.printStackTrace(new PrintWriter(sw));
                StringBuilder trace = new StringBuilder();
                for (String line : sw.toString().split("\n")) {
                    trace.append(line).append("\n");
                    if (line.contains("at Calculator.main(")) break;
                }
                System.err.print("Exception in thread \"main\" " + trace);
                status = 1;
            }
            System.out.flush();
            System.err.flush();
            realOut.println(b64.encodeToString(out.toByteArray()) + "\t" + b64.encodeToString(err.toByteArray()) + "\t" + status);
        }
        realOut.flush();
    }
}
