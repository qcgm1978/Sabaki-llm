import cv2
import numpy as np
def process_go_board_image(image_path, output_sgf_path=None):
    img = cv2.imread(image_path)
    if img is None:
        print(f"无法读取图片: {image_path}")
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    board_contour = None
    max_area = 0
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 1000:
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            if len(approx) == 4 and area > max_area:
                max_area = area
                board_contour = approx
    if board_contour is None:
        print("无法检测到棋盘轮廓")
        return None
    board_contour = board_contour.reshape(-1, 2)
    board_contour = sorted(board_contour, key=lambda x: (x[0], x[1]))
    if board_contour[0][1] > board_contour[1][1]:
        board_contour[0], board_contour[1] = board_contour[1], board_contour[0]
    if board_contour[2][1] < board_contour[3][1]:
        board_contour[2], board_contour[3] = board_contour[3], board_contour[2]
    board_size = 19
    x_min, y_min = np.min(board_contour, axis=0)
    x_max, y_max = np.max(board_contour, axis=0)
    x_step = (x_max - x_min) / (board_size - 1)
    y_step = (y_max - y_min) / (board_size - 1)
    black_stones = []
    white_stones = []
    for i in range(board_size):
        for j in range(board_size):
            x = int(x_min + j * x_step)
            y = int(y_min + i * y_step)
            roi = gray[y-15:y+15, x-15:x+15]
            if roi.shape[0] == 30 and roi.shape[1] == 30:
                mean_val = np.mean(roi)
                if mean_val < 80:
                    black_stones.append((j, board_size - 1 - i))
                elif mean_val > 200:
                    white_stones.append((j, board_size - 1 - i))
    sgf_content = f'(;GM[1]FF[4]CA[UTF-8]SZ[{board_size}])\n'
    if black_stones:
        black_positions = ''.join([_coord_to_sgf(j, i) for j, i in black_stones])
        sgf_content += f'AB{black_positions}\n'
    if white_stones:
        white_positions = ''.join([_coord_to_sgf(j, i) for j, i in white_stones])
        sgf_content += f'AW{white_positions}\n'
    sgf_content += ')'
    if output_sgf_path:
        with open(output_sgf_path, 'w', encoding='utf-8') as f:
            f.write(sgf_content)
    moves_list = get_moves_list(black_stones, white_stones)
    position_string = get_position_string(black_stones, white_stones)
    return sgf_content, moves_list, position_string
def _coord_to_sgf(x, y):
    if x >= 8:
        x_char = chr(ord('a') + x + 1)
    else:
        x_char = chr(ord('a') + x)
    if y >= 8:
        y_char = chr(ord('a') + y + 1)
    else:
        y_char = chr(ord('a') + y)
    return f'[{x_char}{y_char}]'
def get_moves_list(black_stones, white_stones):
    moves = []
    for x, y in black_stones:
        moves.append("B")
        if x >= 8:
            col = chr(ord('a') + x + 1)
        else:
            col = chr(ord('a') + x)
        row = str(y + 1)
        moves.append(f"{col}{row}")
    for x, y in white_stones:
        moves.append("W")
        if x >= 8:
            col = chr(ord('a') + x + 1)
        else:
            col = chr(ord('a') + x)
        row = str(y + 1)
        moves.append(f"{col}{row}")
    return moves

def get_position_string(black_stones, white_stones):
    return ' '.join(get_moves_list(black_stones, white_stones))
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("未提供图片路径，使用默认值: xiuxing.png")
        image_path = "xiuxing.png"
        output_sgf_path = None
    else:
        image_path = sys.argv[1]
        output_sgf_path = sys.argv[2] if len(sys.argv) > 2 else None
    result = process_go_board_image(image_path, output_sgf_path)
    if result:
        sgf_content, moves_list, position_string = result
        print("成功转换图片为SGF格式")
        if output_sgf_path:
            print(f"SGF文件已保存到: {output_sgf_path}")
        else:
            print("\nSGF内容:")
            print(sgf_content)
        print("\n着法列表:")
        print(moves_list)
        print("\nset_position格式字符串:")
        print(position_string)
    else:
        print("转换失败")
        sys.exit(1)