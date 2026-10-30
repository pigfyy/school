



public class TraceFinally {
    public static void main(String[] args) {
        try {
            System.out.println("main: calling f(2)");
            f(2);
            System.out.println("main: calling f(0)");
            f(0);
        } catch (ArithmeticException e) {
            System.out.println("main: caught: " + e.getMessage());
        }
        System.out.println("main: done");
    }

    static void f(int n) {
        System.out.println("  f: calling g(" + n + ")");
        try {
            g(n);
        } finally {
            System.out.println("  f: finally");
        }
        System.out.println("  f: done");
    }

    static void g(int n) {
        if (n == 0) {
            throw new ArithmeticException("cannot divide by zero");
        }
        System.out.println("    g: 12 / " + n + " = " + (12 / n));
    }
}
