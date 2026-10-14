import java.io.File;
import java.io.FileNotFoundException;
import java.util.Scanner;

/**
 * Reads whitespace-separated integers and prints either their sum
 * (default) or their average (with -a/--average).
 *
 * Usage:
 *   java Sum [options] [file]
 *
 * Options:
 *   -a, --average    print the average instead of the sum
 *   --precision=N    digits after the decimal point (only valid
 *                    with -a; defaults to full precision)
 *
 * If a file argument is given, input is read from that file;
 * otherwise it is read from standard input.
 */
public class Sum {

    public static void main(String[] args) {
        boolean average = false;
        boolean precisionGiven = false;
        int precision = 0;
        String filename = null;

        for (String arg : args) {
            if (arg.equals("-a") || arg.equals("--average")) {
                average = true;
            } else if (arg.startsWith("--precision=")) {
                precisionGiven = true;
                String value = arg.substring("--precision=".length());
                try {
                    precision = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    fail("--precision must be an integer, got: "
                            + value);
                }




            } else if (arg.startsWith("-")) {
                fail("unknown option: " + arg);
            } else if (filename == null) {
                filename = arg;
            } else {
                fail("too many file arguments: " + arg);
            }
        }

        if (precisionGiven && !average) {
            fail("--precision is only allowed with -a/--average");
        }

        long sum = 0;
        long count = 0;
        try (Scanner scanner = openInput(filename)) {
            while (scanner.hasNext()) {
                if (scanner.hasNextInt()) {
                    sum += scanner.nextInt();
                    count++;
                } else {
                    fail("not an integer: " + scanner.next());
                }
            }
        } catch (FileNotFoundException e) {
            fail("could not read input: " + e.getMessage());
        }

        if (average) {
            if (count == 0) {
                fail("cannot average zero values");
            }
            double avg = (double) sum / count;
            if (precisionGiven) {
                System.out.printf("%." + precision + "f%n", avg);
            } else {
                System.out.println(avg);
            }
        } else {
            System.out.println(sum);
        }
    }

    private static Scanner openInput(String filename)
            throws FileNotFoundException {
        if (filename == null) {
            return new Scanner(System.in);
        }
        return new Scanner(new File(filename));
    }

    private static void fail(String message) {
        System.err.println("Sum: " + message);
        System.exit(1);
    }
}
