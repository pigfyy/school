// Lecture 2's "Sum, in pieces", verbatim except for the class name (the file must match it).
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class SumPieces {
    public static void main(String[] args) {
        System.out.println("Enter some numbers.");
        List<Integer> list = readList();
        System.out.println("Got " + list);
        System.out.println("The sum of your list was: " + sumList(list));
    }

    static List<Integer> readList() {
        Scanner in = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (in.hasNextInt()) {
            list.add(in.nextInt());
        }
        return list;
    }

    static int sumList(List<Integer> list) {
        int sum = 0;
        for (int i = 0; i < list.size(); i++) {
            sum += list.get(i);
        }
        return sum;
    }
}
