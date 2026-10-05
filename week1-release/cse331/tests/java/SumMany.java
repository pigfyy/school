// Runs the four lecture versions of Sum on many inputs in one JVM (one input per file argument)
// and prints what each run would print, so tests/compare-java.mjs can compare with sum-sim.js.
// The bodies are the lecture's main() verbatim except for the noted line.
import java.nio.file.*;
import java.util.*;

public class SumMany {
  static String orig(String input) {
    StringBuilder out = new StringBuilder();
    Scanner in = new Scanner(input);
    out.append("Enter some numbers.\n");
    List<Integer> list = new ArrayList<>();
    while (in.hasNextInt()) { list.add(in.nextInt()); }
    out.append("Got " + list + "\n");
    int sum = 0;
    for (int i = 0; i < list.size(); i++) { sum += list.get(i); }
    out.append("The sum of your list was: " + sum + "\n");
    return out.toString();
  }
  static String one(String input) {
    StringBuilder out = new StringBuilder();
    Scanner in = new Scanner(input);
    out.append("Enter some numbers.\n");
    List<Integer> list = new ArrayList<>();
    while (in.hasNextInt()) { list.add(in.nextInt()); }
    out.append("Got " + list + "\n");
    int sum = 1; // exercise 4
    for (int i = 0; i < list.size(); i++) { sum += list.get(i); }
    out.append("The sum of your list was: " + sum + "\n");
    return out.toString();
  }
  static String lng(String input) {
    StringBuilder out = new StringBuilder();
    Scanner in = new Scanner(input);
    out.append("Enter some numbers.\n");
    List<Long> list = new ArrayList<>(); // exercise 6
    while (in.hasNextLong()) { list.add(in.nextLong()); }
    out.append("Got " + list + "\n");
    long sum = 0;
    for (int i = 0; i < list.size(); i++) { sum += list.get(i); }
    out.append("The sum of your list was: " + sum + "\n");
    return out.toString();
  }
  static String hasnext(String input) {
    StringBuilder out = new StringBuilder();
    Scanner in = new Scanner(input);
    out.append("Enter some numbers.\n");
    List<Integer> list = new ArrayList<>();
    try {
      while (in.hasNext()) { list.add(in.nextInt()); } // "The edge of the program"
    } catch (InputMismatchException e) {
      return out + "EXCEPTION " + e + "\n";
    }
    out.append("Got " + list + "\n");
    int sum = 0;
    for (int i = 0; i < list.size(); i++) { sum += list.get(i); }
    out.append("The sum of your list was: " + sum + "\n");
    return out.toString();
  }
  public static void main(String[] args) throws Exception {
    Locale.setDefault(Locale.US);
    for (String f : args) {
      String input = Files.readString(Path.of(f));
      System.out.print("=== orig\n" + orig(input));
      System.out.print("=== hasnext\n" + hasnext(input));
      System.out.print("=== one\n" + one(input));
      System.out.print("=== long\n" + lng(input));
      System.out.print("=== end\n");
    }
  }
}
