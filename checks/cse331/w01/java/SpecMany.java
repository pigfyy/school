// Ground truth for site/js/spec-sim.js: runs Lecture 2's code for real and prints one line per call.
// The four indexOf implementations and the three sign implementations are the lecture's, verbatim;
// count is the lecture's client, parameterized by which implementation it calls.
// Output lines:
//   I <impl> <a> <lo> <hi> <x> => <value> | EX <exception class> <message>
//   C <impl> <a> <x> => <value> | EX ...
//   S <impl> <x> => <value> | EX ...
//   M <list> => <value> | EX ...
import java.util.*;

public class SpecMany {
  interface IndexOf { int run(int[] a, int lo, int hi, int x); }

  static int impl1(int[] a, int lo, int hi, int x) {
    for (int i = lo; i < hi; i++) {
      if (a[i] == x) {
        return i;
      }
    }
    return -1;
  }
  static int impl2(int[] a, int lo, int hi, int x) {
    for (int i = lo; i < hi; i++) {
      if (a[i] == x) {
        return i;
      }
    }
    throw new NoSuchElementException();
  }
  static int impl3(int[] a, int lo, int hi, int x) {
    int i = lo;
    while (a[i] != x) {
      i++;
    }
    return i;
  }
  static int impl4(int[] a, int lo, int hi, int x) {
    for (int i = hi - 1; i >= lo; i--) {
      if (a[i] == x) {
        return i;
      }
    }
    return -1;
  }
  static final IndexOf[] IMPLS = { null, SpecMany::impl1, SpecMany::impl2, SpecMany::impl3, SpecMany::impl4 };

  static int count(IndexOf indexOf, int[] a, int x) {
    int c = 0;
    int i = indexOf.run(a, 0, a.length, x);
    while (i != -1) {
      c++;
      i = indexOf.run(a, i + 1, a.length, x);
    }
    return c;
  }

  static int sign1(int x) { return Integer.signum(x); }
  static int sign2(int x) { return x; }
  static int sign3(int x) { return x / Math.abs(x); }

  static int maxList(List<Integer> list) {
    int max = list.get(0);
    for (int i = 1; i < list.size(); i++) {
      if (list.get(i) > max) {
        max = list.get(i);
      }
    }
    return max;
  }

  // sumList as in the lecture, and the same promise kept by adding from the end
  static int sumList(List<Integer> list) {
    int sum = 0;
    for (int i = 0; i < list.size(); i++) {
      sum += list.get(i);
    }
    return sum;
  }
  static int sumListBackward(List<Integer> list) {
    int sum = 0;
    for (int i = list.size() - 1; i >= 0; i--) {
      sum += list.get(i);
    }
    return sum;
  }

  static int middle(List<Integer> list) {
    return list.get(list.size() / 2);
  }

  static String show(java.util.function.IntSupplier f) {
    try { return String.valueOf(f.getAsInt()); }
    catch (RuntimeException e) { return "EX " + e.getClass().getSimpleName() + " " + e.getMessage(); }
  }
  static String arr(int[] a) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); }
    return b.append(']').toString();
  }

  public static void main(String[] args) {
    StringBuilder out = new StringBuilder();
    List<int[]> arrays = new ArrayList<>();
    arrays.add(new int[0]);
    for (int len = 1; len <= 4; len++) {
      int n = (int) Math.pow(3, len);
      for (int k = 0; k < n; k++) {
        int[] a = new int[len];
        int r = k;
        for (int j = 0; j < len; j++) { a[j] = r % 3; r /= 3; }
        arrays.add(a);
      }
    }
    for (int[] a : arrays)
      for (int lo = 0; lo <= a.length; lo++)
        for (int hi = lo; hi <= a.length; hi++)
          for (int x = 0; x <= 3; x++)
            for (int m = 1; m <= 4; m++) {
              final int fm = m, flo = lo, fhi = hi, fx = x;
              out.append("I ").append(m).append(' ').append(arr(a)).append(' ').append(lo).append(' ').append(hi).append(' ').append(x)
                 .append(" => ").append(show(() -> IMPLS[fm].run(a, flo, fhi, fx))).append('\n');
            }
    // count, against every implementation; extra arrays include the lecture's [5, 1, 5, 2, 5]
    List<int[]> countArrays = new ArrayList<>(arrays);
    countArrays.add(new int[] {5, 1, 5, 2, 5});
    countArrays.add(new int[] {7, 7, 7, 7, 7, 7});
    for (int[] a : countArrays)
      for (int x : new int[] {0, 1, 2, 3, 5, 7})
        for (int m = 1; m <= 4; m++) {
          final int fm = m;
          out.append("C ").append(m).append(' ').append(arr(a)).append(' ').append(x)
             .append(" => ").append(show(() -> count(IMPLS[fm], a, x))).append('\n');
        }
    int[] signs = { Integer.MIN_VALUE, Integer.MIN_VALUE + 1, -1000000, -5, -2, -1, 0, 1, 2, 3, 5, 1000000, 2147483646, Integer.MAX_VALUE };
    for (int x : signs) {
      out.append("S 1 ").append(x).append(" => ").append(show(() -> sign1(x))).append('\n');
      out.append("S 2 ").append(x).append(" => ").append(show(() -> sign2(x))).append('\n');
      out.append("S 3 ").append(x).append(" => ").append(show(() -> sign3(x))).append('\n');
    }
    int[][] lists = { {}, {3}, {3, 9, 2}, {-5, -2, -9}, {Integer.MIN_VALUE}, {Integer.MAX_VALUE, Integer.MIN_VALUE}, {4, 4} };
    for (int[] l : lists) {
      List<Integer> list = new ArrayList<>();
      for (int v : l) list.add(v);
      out.append("M ").append(arr(l)).append(" => ").append(show(() -> maxList(list))).append('\n');
    }
    int[][] mids = { {}, {7}, {1, 2}, {4, 8, 15, 16, 23}, {1, 2, 3, 4}, {9, 8, 7}, {5, 6, 7, 8, 9, 10} };
    for (int[] l : mids) {
      List<Integer> list = new ArrayList<>();
      for (int v : l) list.add(v);
      out.append("D ").append(arr(l)).append(" => ").append(show(() -> middle(list))).append('\n');
    }
    Random rnd = new Random(331);
    int[] edge = { 0, 1, -1, Integer.MAX_VALUE, Integer.MIN_VALUE, Integer.MAX_VALUE - 1, Integer.MIN_VALUE + 1 };
    for (int t = 0; t < 300; t++) {
      int n = rnd.nextInt(7);
      List<Integer> list = new ArrayList<>();
      int[] arr = new int[n];
      for (int k = 0; k < n; k++) { arr[k] = rnd.nextBoolean() ? edge[rnd.nextInt(edge.length)] : rnd.nextInt(); list.add(arr[k]); }
      out.append("B ").append(arr(arr)).append(" => ").append(sumList(list)).append(' ').append(sumListBackward(list)).append('\n');
    }
    System.out.print(out);
  }
}
