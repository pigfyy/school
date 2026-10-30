import java.math.BigInteger;
import java.util.Arrays;

/**
 * The methods of Section 2 and Lectures 7 and 8, as the handouts and notes print them, plus the notes' changed
 * copies. main prints one key=value line per question verify.mjs asks; an exception prints as its class name
 * and message.
 */
public class W03 {
    // ---------------------------------------------------------------- Section 2
    static int arraySum(int[] arr) { int sum = 0; for (int v : arr) sum += v; return sum; }
    static int arraySumBuggy(int[] arr) { int sum = arr[0]; for (int i = 0; i < arr.length; i++) sum += arr[i]; return sum; }
    public static int removeValue(int[] a, int n, int x) {
        int w = 0;
        for (int r = 0; r < n; r++) {
            if (a[r] != x) {
                a[w] = a[r];
                w++;
            }
        }
        return w;
    }

    // ---------------------------------------------------------------- Lecture 7
    static long seconds(int h, int m, int s) {
        long t = h;
        t = t * 60 + m;
        t = t * 60 + s;
        return t;
    }
    static int abs(int n) {
        if (n < 0) {
            n = -n;
        }
        return n;
    }
    static int compareChanged(int a, int b) {
        if (a <= b) {
            return -1;
        }
        if (a == b) {
            return 0;
        }
        return 1;
    }
    static int minRepaired(int a, int b) {
        int r = a;
        if (a <= b) {
            r = a;
        } else {
            r = b;
        }
        return r;
    }
    static int quadrant(int x, int y) {
        int q = 1;
        if (x < 0) {
            q = 2;
        }
        if (y < 0) {
            q = q + 1;
        }
        return q;
    }

    // ---------------------------------------------------------------- Lecture 8
    static int checks; // condition checks made by the last call of sum
    static long sum(int[] a) {
        long s = 0;
        int i = 0;
        checks = 1;
        while (i < a.length) {
            s = s + a[i];
            i = i + 1;
            checks++;
        }
        return s;
    }
    static long sumWrongStart(int[] a) {
        long s = 0;
        int i = 1;
        while (i < a.length) {
            s = s + a[i];
            i = i + 1;
        }
        return s;
    }
    static long sumSwapped(int[] a) {
        long s = 0;
        int i = 0;
        while (i < a.length) {
            i = i + 1;
            s = s + a[i];
        }
        return s;
    }
    static long sumWrongExit(int[] a) {
        long s = 0;
        int i = 0;
        while (i < a.length - 1) {
            s = s + a[i];
            i = i + 1;
        }
        return s;
    }
    static long sumTo(int n) {
        long s = 0;
        int i = 0;
        while (i < n) {
            i = i + 1;
            s = s + i;
        }
        return s;
    }
    static long sumToSwapped(int n) {
        long s = 0;
        int i = 0;
        while (i < n) {
            s = s + i;
            i = i + 1;
        }
        return s;
    }
    static int quotientR; // r at the exit of the last call
    static int quotient(int x, int y) {
        int q = 0;
        int r = x;
        while (y <= r) {
            q = q + 1;
            r = r - y;
        }
        quotientR = r;
        return q;
    }
    static long factorial(int n) {
        long f = 1;
        int i = 0;
        while (i != n) {
            i = i + 1;
            f = f * i;
        }
        return f;
    }
    static int count(int[] a, int x) {
        int c = 0;
        int i = 0;
        while (i < a.length) {
            if (a[i] == x) {
                c = c + 1;
            }
            i = i + 1;
        }
        return c;
    }
    static int find(int[] a, int x) {
        int i = 0;
        while (i < a.length) {
            if (a[i] == x) {
                return i;
            }
            i = i + 1;
        }
        return -1;
    }

    interface Call { Object run(); }
    static void p(String key, Call c) {
        String v;
        try { v = String.valueOf(c.run()); } catch (Exception e) { v = e.getClass().getSimpleName() + ": " + e.getMessage(); }
        System.out.println(key + "=" + v);
    }

    public static void main(String[] args) {
        int[] A = {0, 3, 3, -1, 0};
        p("arraySum.multi", () -> arraySum(A));
        p("buggy.empty", () -> arraySumBuggy(new int[0]));
        p("buggy.one", () -> arraySumBuggy(new int[] {5}));
        p("buggy.multi", () -> arraySumBuggy(new int[] {0, 3, 3, -1, 0}));
        int[] arr = {1, 2, 3};
        p("rv.r1", () -> removeValue(arr, 0, 1));
        p("rv.r2", () -> removeValue(arr, 1, 1));
        p("rv.r3", () -> removeValue(arr, 2, 1));
        p("rv.a0", () -> arr[0]);
        p("rv.arr", () -> Arrays.toString(arr));
        int[] q1 = {9, 9, 9}, q2 = {1, 9, 2, 9, 3};
        p("quirk.r9", () -> removeValue(q1, 3, 9));
        p("quirk.first9", () -> q1[0]);
        p("quirk.r5", () -> removeValue(q2, 5, 9));
        p("quirk.a3", () -> q2[3]);
        p("quirk.arr2", () -> Arrays.toString(q2));

        p("seconds.ninety", () -> seconds(0, 90, 0));
        p("seconds.oneEach", () -> seconds(1, 1, 1));
        p("abs.min", () -> abs(-2147483648));
        p("compareChanged.33", () -> compareChanged(3, 3));
        p("minRepaired.21", () -> minRepaired(2, 1));
        p("quadrant.1m1", () -> quadrant(1, -1));
        p("quadrant.5m2", () -> quadrant(5, -2));
        for (int x = -3; x <= 3; x++) for (int y = -3; y <= 3; y++) {
            if (x == 0 || y == 0) continue;
            final int fx = x, fy = y;
            p("quadrant." + x + "," + y, () -> quadrant(fx, fy));
        }
        for (int a = 1; a <= 3; a++) for (int b = 1; b <= 3; b++) {
            final int fa = a, fb = b;
            p("compareChanged." + a + "," + b, () -> compareChanged(fa, fb));
        }

        int[] T = {3, 4, 5};
        p("sum.345", () -> sum(T));
        p("sum.checks345", () -> { sum(T); return checks; });
        for (String[] t : new String[][] {{"empty", ""}, {"seven", "7"}, {"345", "3,4,5"}}) {
            int[] a = t[1].isEmpty() ? new int[0] : Arrays.stream(t[1].split(",")).mapToInt(Integer::parseInt).toArray();
            p("sum." + t[0], () -> sum(a));
            p("start." + t[0], () -> sumWrongStart(a));
            p("swapped." + t[0], () -> sumSwapped(a));
            p("exit." + t[0], () -> sumWrongExit(a));
        }
        p("sumTo.4", () -> sumTo(4));
        p("sumToSwapped.4", () -> sumToSwapped(4));
        p("quotient.17.5", () -> quotient(17, 5));
        p("quotient.r", () -> { quotient(17, 5); return quotientR; });
        p("factorial.5", () -> factorial(5));
        p("factorial.20", () -> factorial(20));
        p("factorial.21", () -> factorial(21));
        BigInteger f21 = BigInteger.ONE;
        for (int i = 2; i <= 21; i++) f21 = f21.multiply(BigInteger.valueOf(i));
        final BigInteger F21 = f21;
        p("factorial.21exact", () -> F21);
        p("count.55", () -> count(new int[] {5, 1, 5, 2, 5}, 5));
        p("find.4", () -> find(new int[] {4, 7, 4}, 4));
        p("find.9", () -> find(new int[] {4, 7, 4}, 9));
    }
}
