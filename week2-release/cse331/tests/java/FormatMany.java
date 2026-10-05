// Ground truth for the simulator's double formatting: reads "sum count precision" triples and prints
// Double.toString((double) sum / count) and String.format("%.Nf", ...) exactly as Sum.java does.
import java.util.*;
public class FormatMany {
  public static void main(String[] a) {
    Scanner in = new Scanner(System.in);
    while (in.hasNextLong()) {
      long sum = in.nextLong(); long count = in.nextLong(); int p = in.nextInt();
      double avg = (double) sum / count;
      System.out.println(sum + " " + count + " " + p + " | " + avg + " | " + String.format("%." + p + "f", avg));
    }
  }
}
